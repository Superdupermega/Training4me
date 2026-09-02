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
const getDebriefForSession = vi.fn().mockResolvedValue(null);
vi.mock('./repo', () => ({
  insertCoachMessage: (...args: unknown[]) => insertCoachMessage(...args),
  listCoachMessages: (...args: unknown[]) => listCoachMessages(...args),
  getDebriefForSession: (...args: unknown[]) => getDebriefForSession(...args),
}));

const getProfile = vi.fn();
const getActiveProgram = vi.fn().mockResolvedValue(null);
const listPRs = vi.fn().mockResolvedValue([]);
const listSessions = vi.fn().mockResolvedValue([]);
const getSession = vi.fn();
const getLoggedSets = vi.fn().mockResolvedValue([]);
const listPRsForSession = vi.fn().mockResolvedValue([]);
const recentSessions = vi.fn().mockResolvedValue([]);
vi.mock('../repo', () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
  getActiveProgram: (...args: unknown[]) => getActiveProgram(...args),
  listPRs: (...args: unknown[]) => listPRs(...args),
  listSessions: (...args: unknown[]) => listSessions(...args),
  getSession: (...args: unknown[]) => getSession(...args),
  getLoggedSets: (...args: unknown[]) => getLoggedSets(...args),
  listPRsForSession: (...args: unknown[]) => listPRsForSession(...args),
  recentSessions: (...args: unknown[]) => recentSessions(...args),
  TAGS: { coach: 'coach' },
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

// Imported after the mocks above so the module under test picks them up.
const { generateSessionDebrief, sendCoachMessage } = await import('./actions');

function session(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sess-1', programId: 'prog-1', weekNumber: 3, dayNumber: 1, weekday: 1,
    scheduledDate: '2026-09-01', archetype: 'lower', title: 'Squat Day',
    mainPattern: 'squat', isDeload: false, estimatedSec: 1300,
    blocks: [
      {
        letter: 'A', kind: 'main', name: 'Back Squat', estimatedSec: 900,
        exercises: [
          {
            slot: 'A1', exerciseId: 'back-squat', tempo: '20X0', cue: 'Brace.',
            sets: [{ setNumber: 1, kind: 'working', reps: 5, weightKg: 100, restSec: 150, estimatedSec: 60 }],
          },
        ],
      },
    ],
    status: 'completed', startedAt: '2026-09-01T18:00:00.000Z', completedAt: '2026-09-01T19:00:00.000Z',
    actualSec: 1500, readiness: null, autoregulated: false, notes: null,
    ...overrides,
  };
}

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
  getDebriefForSession.mockResolvedValue(null);
  getSession.mockResolvedValue(session());
  getLoggedSets.mockResolvedValue([]);
  listPRsForSession.mockResolvedValue([]);
  recentSessions.mockResolvedValue([]);
  insertCoachMessage.mockImplementation(async (msg: { role: string; content: string; sessionId?: string | null }) => ({
    id: 'msg-1', role: msg.role, kind: msg.role === 'assistant' && msg.sessionId ? 'debrief' : 'chat',
    content: msg.content, sessionId: msg.sessionId ?? null, proposal: null, proposalStatus: null,
    createdAt: '2026-09-02T00:00:00.000Z',
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

describe('generateSessionDebrief', () => {
  it('calls requireUnlocked before anything else', async () => {
    requireUnlocked.mockRejectedValueOnce(new Error('Locked'));
    const result = await generateSessionDebrief('sess-1');
    expect(result).toEqual({ ok: false, error: 'Locked' });
    expect(isCoachConfigured).not.toHaveBeenCalled();
    expect(getDebriefForSession).not.toHaveBeenCalled();
    expect(coachCompletion).not.toHaveBeenCalled();
  });

  it('refuses cleanly when the coach is not configured, before touching the database at all', async () => {
    isCoachConfigured.mockReturnValue(false);
    const result = await generateSessionDebrief('sess-1');
    expect(result).toEqual({ ok: false, error: 'Coach is not configured.' });
    expect(getDebriefForSession).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(coachCompletion).not.toHaveBeenCalled();
  });

  it('an existing debrief is returned directly — coachCompletion is never called', async () => {
    getDebriefForSession.mockResolvedValue({
      id: 'msg-1', role: 'assistant', kind: 'debrief', content: 'Solid squat day, PR on the top set.',
      sessionId: 'sess-1', proposal: null, proposalStatus: null, createdAt: '2026-09-01T19:00:00.000Z',
    });
    const result = await generateSessionDebrief('sess-1');
    expect(result).toEqual({ ok: true, data: { text: 'Solid squat day, PR on the top set.' } });
    expect(getSession).not.toHaveBeenCalled();
    expect(coachCompletion).not.toHaveBeenCalled();
    expect(insertCoachMessage).not.toHaveBeenCalled();
  });

  it('two calls for the same sessionId only ever call coachCompletion once', async () => {
    coachCompletion.mockResolvedValue({ ok: true, data: { text: 'Good session.' } });
    insertCoachMessage.mockImplementation(async (msg: { role: string; content: string; sessionId?: string | null }) => ({
      id: 'debrief-1', role: msg.role, kind: 'debrief', content: msg.content,
      sessionId: msg.sessionId ?? null, proposal: null, proposalStatus: null,
      createdAt: '2026-09-01T19:00:00.000Z',
    }));

    const first = await generateSessionDebrief('sess-1');
    expect(first).toEqual({ ok: true, data: { text: 'Good session.' } });
    expect(coachCompletion).toHaveBeenCalledTimes(1);

    // The second call now finds the row the first call just inserted.
    getDebriefForSession.mockResolvedValue({
      id: 'debrief-1', role: 'assistant', kind: 'debrief', content: 'Good session.',
      sessionId: 'sess-1', proposal: null, proposalStatus: null, createdAt: '2026-09-01T19:00:00.000Z',
    });
    const second = await generateSessionDebrief('sess-1');
    expect(second).toEqual({ ok: true, data: { text: 'Good session.' } });
    expect(coachCompletion).toHaveBeenCalledTimes(1);
  });

  it('a session that has not finished refuses without calling the model', async () => {
    getSession.mockResolvedValue(session({ status: 'in_progress' }));
    const result = await generateSessionDebrief('sess-1');
    expect(result).toEqual({ ok: false, error: 'Session is not finished yet.' });
    expect(coachCompletion).not.toHaveBeenCalled();
  });

  it('an unknown session id refuses without calling the model', async () => {
    getSession.mockResolvedValue(null);
    const result = await generateSessionDebrief('nope');
    expect(result).toEqual({ ok: false, error: 'Session not found.' });
    expect(coachCompletion).not.toHaveBeenCalled();
  });

  it('on success: builds context, calls the model with kind "debrief", saves the reply keyed to the session', async () => {
    listPRsForSession.mockResolvedValue([
      { id: 'pr-1', exercise_id: 'back-squat', kind: 'e1rm', value: 115, reps: 5, weight_kg: 100, achieved_at: '2026-09-01T19:00:00.000Z', session_id: 'sess-1' },
    ]);
    coachCompletion.mockResolvedValue({ ok: true, data: { text: 'Great squat day — new e1RM.' } });
    insertCoachMessage.mockImplementation(async (msg: { role: string; content: string; sessionId?: string | null }) => ({
      id: 'debrief-1', role: msg.role, kind: 'debrief', content: msg.content,
      sessionId: msg.sessionId ?? null, proposal: null, proposalStatus: null,
      createdAt: '2026-09-01T19:00:00.000Z',
    }));

    const result = await generateSessionDebrief('sess-1');

    expect(coachCompletion).toHaveBeenCalledTimes(1);
    const call = coachCompletion.mock.calls[0]![0];
    expect(call.kind).toBe('debrief');
    expect(call.system).toContain('Back Squat estimated 1RM: 100 kg x 5');
    expect(call.messages).toEqual([{ role: 'user', content: 'React to this session.' }]);
    expect(insertCoachMessage).toHaveBeenCalledWith({
      role: 'assistant', kind: 'debrief', content: 'Great squat day — new e1RM.', sessionId: 'sess-1',
    });
    expect(result).toEqual({ ok: true, data: { text: 'Great squat day — new e1RM.' } });
  });

  it('propagates a coachCompletion failure without saving anything', async () => {
    coachCompletion.mockResolvedValue({ ok: false, error: 'Coach is resting for today — back tomorrow.' });
    const result = await generateSessionDebrief('sess-1');
    expect(result).toEqual({ ok: false, error: 'Coach is resting for today — back tomorrow.' });
    expect(insertCoachMessage).not.toHaveBeenCalled();
  });
});
