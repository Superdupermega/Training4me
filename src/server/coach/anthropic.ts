import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_TIMEZONE } from '@/core/dates';
import { capCheck } from '@/core/coach/costCap';
import { dailyCapUsd, isCoachConfigured, monthlyCapUsd } from './config';
import * as repo from './repo';
import type { Result } from './result';

/**
 * The one file that imports `@anthropic-ai/sdk` — every other coach module
 * reaches the API only through `coachCompletion` below
 * (`docs/11-COACH-PLATFORM.md §4`). No streaming (§7: one request/response
 * per turn is enough for a short reply and keeps the client bundle and
 * failure modes simple).
 */

export type CoachKind = 'chat' | 'debrief' | 'proposal';

/**
 * Cheapest capability that fits each job (`docs/11-COACH-PLATFORM.md §2`):
 * chat and the debrief are read-heavy, short-context, low-reasoning-load —
 * an opinion about a training log, not a proof. Proposals (chunk 28's
 * tool-calling turn against the five product constraints) are the one call
 * worth paying more for.
 *
 * Model ids and per-token prices confirmed against the `claude-api` skill's
 * current model table (cached 2026-06-24) at the time this chunk was
 * written, not trusted from `11-COACH-PLATFORM.md`'s own numbers — see
 * `DECISIONS.md`, chunk 25, for the exact source and figures. Re-check both
 * before trusting this file on a much later date; prices and ids drift.
 */
const MODEL_FOR_KIND: Record<CoachKind, string> = {
  chat: 'claude-haiku-4-5',
  debrief: 'claude-haiku-4-5',
  proposal: 'claude-sonnet-5',
};

/** USD per million tokens. */
const PRICE_PER_MTOK_USD: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-5': { input: 2.0, output: 10.0 },
};

/**
 * A short factual reply doesn't need much room, and this app pays for
 * output tokens out of a hard daily/monthly dollar cap — a generous ceiling
 * here would let one unusually long reply eat a disproportionate share of
 * it. Proposals (chunk 28) get more room for the tool-call JSON plus a short
 * explanation.
 */
const MAX_TOKENS_FOR_KIND: Record<CoachKind, number> = {
  chat: 1024,
  debrief: 512,
  proposal: 2048,
};

// Memoised at module scope for the same reason `db.ts`'s client is: no
// per-request state, so a new client per call is pure waste.
let client: Anthropic | null = null;
function anthropicClient(): Anthropic {
  // Reads ANTHROPIC_API_KEY from the environment itself — never constructed
  // unless isCoachConfigured() has already passed, both here and in every
  // caller, so this line never runs against an absent key.
  if (!client) client = new Anthropic();
  return client;
}

export interface CoachCompletionArgs {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  kind: CoachKind;
  tools?: Anthropic.Tool[];
  /** The athlete's own timezone, for the cap check's "start of day/month" — defaults to the app default. */
  timezone?: string;
}

export interface CoachCompletionData {
  text: string;
  toolUse?: { name: string; input: unknown };
}

function roundCost(usd: number): number {
  // numeric(8,4) — matches the column, and keeps a $0.000000001-style
  // floating point artefact out of what gets stored.
  return Math.round(usd * 10_000) / 10_000;
}

/**
 * The single exported function every coach action calls. Checks
 * `isCoachConfigured()` (defensive — every caller already has, but an
 * action is a public endpoint regardless of what the UI shows, same
 * reasoning as `requireUnlocked()`), checks the cost cap *before* the
 * network call, makes the call, records real usage from the response's
 * actual `usage` *after* — even on a refusal, since tokens were still
 * spent — and returns `{ ok: false, error }` on any failure rather than
 * throwing (`00-CONTEXT.md §5`'s `Result<T>` contract, same as every other
 * server-facing function).
 */
export async function coachCompletion(args: CoachCompletionArgs): Promise<Result<CoachCompletionData>> {
  if (!isCoachConfigured()) return { ok: false, error: 'Coach is not configured.' };

  const timezone = args.timezone ?? DEFAULT_TIMEZONE;
  const [spentToday, spentThisMonth] = await Promise.all([
    repo.spentToday(timezone),
    repo.spentThisMonth(timezone),
  ]);
  const cap = capCheck(spentToday, spentThisMonth, dailyCapUsd(), monthlyCapUsd());
  if (!cap.allowed) {
    return {
      ok: false,
      error: cap.reason === 'daily'
        ? 'Coach is resting for today — back tomorrow.'
        : 'Coach is resting for the month — back next month.',
    };
  }

  const model = MODEL_FOR_KIND[args.kind];
  let response: Anthropic.Message;
  try {
    response = await anthropicClient().messages.create({
      model,
      max_tokens: MAX_TOKENS_FOR_KIND[args.kind],
      system: args.system,
      messages: args.messages,
      ...(args.tools ? { tools: args.tools } : {}),
    });
  } catch (err) {
    // Most-specific first — a single broad `catch` would lose the
    // retryable/non-retryable distinction the SDK's typed classes exist to
    // carry (rate limit and auth failures read very differently to the
    // athlete than a bad request would).
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: 'Coach is busy right now — try again in a moment.' };
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: 'Coach is misconfigured (invalid API key).' };
    if (err instanceof Anthropic.APIError) return { ok: false, error: `Coach request failed: ${err.message}` };
    if (err instanceof Anthropic.APIConnectionError) return { ok: false, error: 'Could not reach the coach — check the connection.' };
    return { ok: false, error: err instanceof Error ? err.message : 'Coach request failed.' };
  }

  const price = PRICE_PER_MTOK_USD[model]!;
  const costUsd = roundCost(
    (response.usage.input_tokens / 1_000_000) * price.input
    + (response.usage.output_tokens / 1_000_000) * price.output,
  );
  await repo.recordUsage({
    kind: args.kind, model,
    inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    costUsd,
  });

  if (response.stop_reason === 'refusal') {
    return { ok: false, error: 'Coach declined to answer that.' };
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

  return {
    ok: true,
    data: {
      text: textBlock?.text ?? '',
      toolUse: toolBlock ? { name: toolBlock.name, input: toolBlock.input } : undefined,
    },
  };
}
