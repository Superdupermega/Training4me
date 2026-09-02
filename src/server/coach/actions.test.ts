import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireUnlocked = vi.fn().mockResolvedValue(undefined);
vi.mock('../authGuard', () => ({
  requireUnlocked: (...args: unknown[]) => requireUnlocked(...args),
}));

const isCoachConfigured = vi.fn().mockReturnValue(true);
vi.mock('./config', () => ({
  isCoachConfigured: () => isCoachConfigured(),
}));

const coachCompletion = vi.fn();
vi.mock('./anthropic', () => ({
  coachCompletion: (...args: unknown[]) => coachCompletion(...args),
}));

const insertCoachMessage = vi.fn();
const listCoachMessages = vi.fn().mockResolvedValue([]);
vi.mock('./repo', () => ({
  insertCoachMessage: (...args: unknown[]) => insertCoachMessage(...args),
  listCoachMessages: (...args: unknown[]) => listCoachMessages(...args),
}));

const getProfile = vi.fn();
const getActiveProgram = vi.fn().mockResolvedValue(null);
const listPRs = vi.fn().mockResolvedValue([]);
const listSessions = vi.fn().mockResolvedValue([]);
vi.mock('../repo', () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
  getActiveProgram: (...args: unknown[]) => getActiveProgram(...args),
  listPRs: (...args: unknown[]) => listPRs(...args),
  listSessions: (...args: unknown[]) => listSessions(...args),
  TAGS: { coach: 'coach' },
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

// Imported after the mocks above so the module under test picks them up.
const { sendCoachMessage } = await import('./actions');

function profile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    displayName: null, experience: 'intermediate', daysPerWeek: 4, sessionCapSec: 3600,
    equipmentProfile: 'full_gym', equipment: [], allowAdvanced: false, microPlates: false,
    bodyweightKg: 80, paceFactor: 1, preferredWeekdays: [], mesocycleWeeks: 6,
    onboardedAt: '2026-08-01T00:00:00.000Z', timezone: 'Europe/Stockholm',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUnlocked.mockResolvedValue(undefined);
  isCoachConfigured.mockReturnValue(true);
  getProfile.mockResolvedValue(profile());
  getActiveProgram.mockResolvedValue(null);
  listPRs.mockResolvedValue([]);
  listSessions.mockResolvedValue([]);
  listCoachMessages.mockResolvedValue([]);
  insertCoachMessage.mockImplementation(async (msg: { role: string; content: string }) => ({
    id: 'msg-1', role: msg.role, kind: 'chat', content: msg.content,
    sessionId: null, proposal: null, proposalStatus: null, createdAt: '2026-09-02T00:00:00.000Z',
  }));
});

describe('sendCoachMessage', () => {
  it('calls requireUnlocked before anything else', async () => {
    requireUnlocked.mockRejectedValueOnce(new Error('Locked'));
    const result = await sendCoachMessage('hello');
    expect(result).toEqual({ ok: false, error: 'Locked' });
    expect(requireUnlocked).toHaveBeenCalledTimes(1);
    // Nothing past the guard ran.
    expect(isCoachConfigured).not.toHaveBeenCalled();
    expect(insertCoachMessage).not.toHaveBeenCalled();
    expect(coachCompletion).not.toHaveBeenCalled();
  });

  it('refuses cleanly when the coach is not configured, without ever calling coachCompletion (so the Anthropic SDK is never constructed)', async () => {
    isCoachConfigured.mockReturnValue(false);
    const result = await sendCoachMessage('hello');
    expect(result).toEqual({ ok: false, error: 'Coach is not configured.' });
    expect(requireUnlocked).toHaveBeenCalledTimes(1);
    expect(insertCoachMessage).not.toHaveBeenCalled();
    expect(coachCompletion).not.toHaveBeenCalled();
  });

  it('refuses an empty message without calling the model', async () => {
    const result = await sendCoachMessage('   ');
    expect(result).toEqual({ ok: false, error: 'Message is empty.' });
    expect(insertCoachMessage).not.toHaveBeenCalled();
    expect(coachCompletion).not.toHaveBeenCalled();
  });

  it('on success: saves the user message, calls the model, saves the reply, returns its id', async () => {
    listCoachMessages.mockResolvedValue([
      {
        id: 'msg-1', role: 'user', kind: 'chat', content: 'How is my squat going?',
        sessionId: null, proposal: null, proposalStatus: null, createdAt: '2026-09-02T00:00:00.000Z',
      },
    ]);
    coachCompletion.mockResolvedValue({ ok: true, data: { text: 'Your squat is trending up.' } });
    insertCoachMessage.mockImplementationOnce(async () => ({
      id: 'user-msg', role: 'user', kind: 'chat', content: 'How is my squat going?',
      sessionId: null, proposal: null, proposalStatus: null, createdAt: '2026-09-02T00:00:00.000Z',
    })).mockImplementationOnce(async () => ({
      id: 'reply-1', role: 'assistant', kind: 'chat', content: 'Your squat is trending up.',
      sessionId: null, proposal: null, proposalStatus: null, createdAt: '2026-09-02T00:00:01.000Z',
    }));

    const result = await sendCoachMessage('How is my squat going?');

    expect(insertCoachMessage).toHaveBeenNthCalledWith(1, { role: 'user', kind: 'chat', content: 'How is my squat going?' });
    expect(coachCompletion).toHaveBeenCalledTimes(1);
    const call = coachCompletion.mock.calls[0]![0];
    expect(call.kind).toBe('chat');
    expect(call.system).toContain('Facts about this athlete');
    expect(call.messages).toEqual([{ role: 'user', content: 'How is my squat going?' }]);
    expect(insertCoachMessage).toHaveBeenNthCalledWith(2, { role: 'assistant', kind: 'chat', content: 'Your squat is trending up.' });
    expect(result).toEqual({ ok: true, data: { replyId: 'reply-1' } });
  });

  it('propagates a coachCompletion failure (e.g. over cap) as its own result, without saving a reply', async () => {
    coachCompletion.mockResolvedValue({ ok: false, error: 'Coach is resting for today — back tomorrow.' });
    const result = await sendCoachMessage('hello');
    expect(result).toEqual({ ok: false, error: 'Coach is resting for today — back tomorrow.' });
    // Only the user's own message was saved — never a reply.
    expect(insertCoachMessage).toHaveBeenCalledTimes(1);
  });
});
