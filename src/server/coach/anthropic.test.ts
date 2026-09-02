import { beforeEach, describe, expect, it, vi } from 'vitest';

// A minimal stand-in for the SDK: a constructor spy plus a `messages.create`
// spy, and the handful of static error classes `anthropic.ts` checks
// `instanceof` against. Every test asserts against these spies directly —
// this is the "strong version" of the cap-check test the chunk brief asks
// for: proof the SDK client was never constructed, not just that the
// wrapper returned a refusal.
const ctorSpy = vi.fn();
const messagesCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  class APIConnectionError extends Error {}
  class MockAnthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    static AuthenticationError = AuthenticationError;
    static APIConnectionError = APIConnectionError;
    messages = { create: (...args: unknown[]) => messagesCreate(...args) };
    constructor(...args: unknown[]) {
      ctorSpy(...args);
    }
  }
  return { default: MockAnthropic };
});

const isCoachConfigured = vi.fn().mockReturnValue(true);
const dailyCapUsd = vi.fn().mockReturnValue(2);
const monthlyCapUsd = vi.fn().mockReturnValue(20);
vi.mock('./config', () => ({
  isCoachConfigured: () => isCoachConfigured(),
  dailyCapUsd: () => dailyCapUsd(),
  monthlyCapUsd: () => monthlyCapUsd(),
}));

const spentToday = vi.fn().mockResolvedValue(0);
const spentThisMonth = vi.fn().mockResolvedValue(0);
const recordUsage = vi.fn().mockResolvedValue(undefined);
vi.mock('./repo', () => ({
  spentToday: (...args: unknown[]) => spentToday(...args),
  spentThisMonth: (...args: unknown[]) => spentThisMonth(...args),
  recordUsage: (...args: unknown[]) => recordUsage(...args),
}));

const { coachCompletion } = await import('./anthropic');

beforeEach(() => {
  vi.clearAllMocks();
  isCoachConfigured.mockReturnValue(true);
  dailyCapUsd.mockReturnValue(2);
  monthlyCapUsd.mockReturnValue(20);
  spentToday.mockResolvedValue(0);
  spentThisMonth.mockResolvedValue(0);
});

const baseArgs = { system: 'You are the coach.', messages: [{ role: 'user' as const, content: 'hi' }], kind: 'chat' as const };

describe('coachCompletion', () => {
  it('refuses when the coach is not configured, before ever constructing the SDK client', async () => {
    isCoachConfigured.mockReturnValue(false);
    const result = await coachCompletion(baseArgs);
    expect(result).toEqual({ ok: false, error: 'Coach is not configured.' });
    expect(ctorSpy).not.toHaveBeenCalled();
    expect(messagesCreate).not.toHaveBeenCalled();
    expect(spentToday).not.toHaveBeenCalled();
  });

  it('refuses once today is over the daily cap, before any Anthropic request — the SDK client is never constructed', async () => {
    spentToday.mockResolvedValue(5); // over the $2 default
    const result = await coachCompletion(baseArgs);
    expect(result).toEqual({ ok: false, error: 'Coach is resting for today — back tomorrow.' });
    expect(ctorSpy).not.toHaveBeenCalled();
    expect(messagesCreate).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it('refuses once the month is over cap (but today is fine), before any Anthropic request', async () => {
    spentToday.mockResolvedValue(0.5);
    spentThisMonth.mockResolvedValue(25); // over the $20 default
    const result = await coachCompletion(baseArgs);
    expect(result).toEqual({ ok: false, error: 'Coach is resting for the month — back next month.' });
    expect(ctorSpy).not.toHaveBeenCalled();
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it('under cap: calls the SDK once, records real usage from the response, and returns the reply text', async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Your squat is trending up.' }],
      usage: { input_tokens: 500_000, output_tokens: 100_000 },
      stop_reason: 'end_turn',
    });

    const result = await coachCompletion(baseArgs);

    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(messagesCreate).toHaveBeenCalledTimes(1);
    const call = messagesCreate.mock.calls[0]![0];
    expect(call.model).toBe('claude-haiku-4-5');
    expect(call.system).toBe('You are the coach.');
    expect(call.messages).toEqual([{ role: 'user', content: 'hi' }]);

    // 500k input @ $1/MTok + 100k output @ $5/MTok = $0.50 + $0.50 = $1.00 exactly.
    expect(recordUsage).toHaveBeenCalledWith({
      kind: 'chat', model: 'claude-haiku-4-5',
      inputTokens: 500_000, outputTokens: 100_000, costUsd: 1,
    });
    expect(result).toEqual({ ok: true, data: { text: 'Your squat is trending up.', toolUse: undefined } });
  });

  it('picks claude-sonnet-5 for a proposal-kind call', async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 100, output_tokens: 100 },
      stop_reason: 'end_turn',
    });
    await coachCompletion({ ...baseArgs, kind: 'proposal' });
    expect(messagesCreate.mock.calls[0]![0].model).toBe('claude-sonnet-5');
  });

  it('a stop_reason of "refusal" is reported as a failure, but usage is still recorded — real tokens were still spent', async () => {
    messagesCreate.mockResolvedValue({
      content: [],
      usage: { input_tokens: 50, output_tokens: 10 },
      stop_reason: 'refusal',
    });
    const result = await coachCompletion(baseArgs);
    expect(result.ok).toBe(false);
    expect(recordUsage).toHaveBeenCalledTimes(1);
  });

  it('a rate-limit error from the SDK returns a clean Result rather than throwing', async () => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    // The mocked class's real constructor takes just a message (see the
    // `vi.mock` above); the *type* TS checks against is still the real
    // SDK's multi-arg signature, so build the instance via the prototype
    // instead of `new` to keep this test's intent (an SDK-typed rate-limit
    // error) without fighting the type checker over a mock's shape.
    const err = Object.create(Anthropic.RateLimitError.prototype) as Error;
    err.message = 'slow down';
    messagesCreate.mockRejectedValue(err);
    const result = await coachCompletion(baseArgs);
    expect(result).toEqual({ ok: false, error: 'Coach is busy right now — try again in a moment.' });
  });
});
