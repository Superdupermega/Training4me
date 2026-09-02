import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlockExercise, SessionBlock } from '@/core/types';

const getActiveProgram = vi.fn();
const listSessions = vi.fn();
const getProfile = vi.fn();
const getTrainingMaxes = vi.fn();
const persistProgram = vi.fn();
const getLogsForProgram = vi.fn();

vi.mock('./repo', () => ({
  getActiveProgram: (...args: unknown[]) => getActiveProgram(...args),
  listSessions: (...args: unknown[]) => listSessions(...args),
  getProfile: (...args: unknown[]) => getProfile(...args),
  getTrainingMaxes: (...args: unknown[]) => getTrainingMaxes(...args),
  persistProgram: (...args: unknown[]) => persistProgram(...args),
  getLogsForProgram: (...args: unknown[]) => getLogsForProgram(...args),
}));

// Imported after the mock above so the module under test picks it up.
const { startTestWeek, computeTestedOverrides, testWeekMeta } = await import('./testWeek');
const { buildTestWeek } = await import('@/core/progression/testWeek');

function be(exerciseId: string, slot = 'X'): BlockExercise {
  return { slot, exerciseId, tempo: '2010', cue: 'cue', sets: [{ setNumber: 1, kind: 'working', reps: 5, restSec: 90, estimatedSec: 0 }] };
}

function block(letter: string, kind: SessionBlock['kind'], exerciseId: string): SessionBlock {
  return { letter, kind, name: kind, exercises: [be(exerciseId, `${letter}1`)], estimatedSec: 0 };
}

function sessionRow(fields: { id: string; weekNumber: number; weekday: number; blocks: SessionBlock[] }) {
  return {
    id: fields.id, programId: 'p1', weekNumber: fields.weekNumber, dayNumber: fields.weekNumber,
    weekday: fields.weekday, scheduledDate: '2026-08-03', archetype: 'FB-A', title: 'Day',
    mainPattern: null, isDeload: false, estimatedSec: 0, blocks: fields.blocks,
    status: 'completed', startedAt: null, completedAt: null, actualSec: null, readiness: null,
    autoregulated: false, notes: null,
  };
}

const squatDay = sessionRow({
  id: 's1', weekNumber: 1, weekday: 1,
  blocks: [block('A', 'primer', 'goblet-squat'), block('B', 'main', 'back-squat'), block('C', 'secondary', 'walking-lunge')],
});
const benchDay = sessionRow({
  id: 's2', weekNumber: 1, weekday: 3,
  blocks: [block('A', 'primer', 'band-pull-apart'), block('B', 'main', 'bench-press')],
});

const activeProgram = {
  id: 'p1', name: 'Block One', weeks: 4, daysPerWeek: 2, startDate: '2026-08-03', status: 'active',
  input: {}, routineId: null, tmChanges: null,
};

function profile() {
  return {
    displayName: null, experience: 'intermediate', daysPerWeek: 2, sessionCapSec: 3600,
    equipmentProfile: 'full_gym', equipment: [], allowAdvanced: false, microPlates: false,
    bodyweightKg: 80, paceFactor: 1, preferredWeekdays: [], mesocycleWeeks: 4,
    onboardedAt: '2026-08-01T00:00:00.000Z', timezone: 'Europe/Stockholm',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getActiveProgram.mockResolvedValue(activeProgram);
  listSessions.mockResolvedValue([squatDay, benchDay]);
  getProfile.mockResolvedValue(profile());
  getTrainingMaxes.mockResolvedValue({ 'back-squat': 140, 'bench-press': 100 });
  persistProgram.mockResolvedValue('tw1');
});

describe('startTestWeek', () => {
  it('throws when there is no finished block to test', async () => {
    getActiveProgram.mockResolvedValue(null);
    await expect(startTestWeek()).rejects.toThrow(/no finished block/i);
  });

  it('defaults to every T1 lift the block actually trained', async () => {
    listSessions.mockImplementation((programId: string) =>
      Promise.resolve(programId === 'tw1' ? [{ id: 'ts1' }, { id: 'ts2' }] : [squatDay, benchDay]));
    const result = await startTestWeek();
    expect(persistProgram).toHaveBeenCalledTimes(1);
    const persisted = persistProgram.mock.calls[0]![0];
    expect(persisted.input.source).toBe('test_week');
    expect(persisted.input.testExerciseIds.sort()).toEqual(['back-squat', 'bench-press']);
    expect(persisted.input.parentProgramId).toBe('p1');
    expect(persisted.plan[0].sessions).toHaveLength(2);
    expect(result.programId).toBe('tw1');
    expect(result.sessionIds).toEqual(['ts1', 'ts2']);
  });

  it('tests only the requested subset when given one', async () => {
    listSessions.mockImplementation((programId: string) =>
      Promise.resolve(programId === 'tw1' ? [{ id: 'ts1' }] : [squatDay, benchDay]));
    await startTestWeek(['back-squat']);
    const persisted = persistProgram.mock.calls[0]![0];
    expect(persisted.input.testExerciseIds).toEqual(['back-squat']);
    expect(persisted.plan[0].sessions).toHaveLength(1);
  });

  it('throws when none of the requested lifts were trained in this block', async () => {
    await expect(startTestWeek(['overhead-press'])).rejects.toThrow(/none of the requested/i);
    expect(persistProgram).not.toHaveBeenCalled();
  });
});

describe('testWeekMeta', () => {
  it('recognises a test-week program by its input.source marker', () => {
    expect(testWeekMeta(activeProgram as never)).toBeNull();
    expect(testWeekMeta({
      ...activeProgram,
      input: { source: 'test_week', testExerciseIds: ['back-squat'], parentProgramId: 'p1' },
    } as never)).toEqual({ source: 'test_week', testExerciseIds: ['back-squat'], parentProgramId: 'p1' });
  });
});

describe('computeTestedOverrides', () => {
  const meta = { source: 'test_week' as const, testExerciseIds: ['back-squat', 'bench-press'], parentProgramId: 'p1' };
  const testProgram = { ...activeProgram, id: 'tw1', weeks: 1 };

  it('takes the heaviest logged attempt per tested exercise, ties broken by reps', async () => {
    listSessions.mockResolvedValue([squatDay]);
    getLogsForProgram.mockResolvedValue([
      { session_id: 's1', exercise_id: 'back-squat', reps: 1, weight_kg: 140, skipped: false },
      // A heavier on-the-fly attempt logged after the prescribed top single.
      { session_id: 's1', exercise_id: 'back-squat', reps: 1, weight_kg: 145, skipped: false },
      { session_id: 's1', exercise_id: 'back-squat', reps: 3, weight_kg: 120, skipped: false },
    ]);
    const overrides = await computeTestedOverrides(testProgram as never, { ...meta, testExerciseIds: ['back-squat'] });
    expect(overrides).toHaveLength(1);
    expect(overrides[0]!.exerciseId).toBe('back-squat');
    expect(overrides[0]!.value).toBe(145); // trainingMaxFromTestResult(145, 1) === 145
    expect(overrides[0]!.reason).toMatch(/tested — 1 rep at 145 kg/);
  });

  it('leaves out a lift that was never attempted, so the inferred path still applies to it', async () => {
    listSessions.mockResolvedValue([squatDay, benchDay]);
    getLogsForProgram.mockResolvedValue([
      { session_id: 's1', exercise_id: 'back-squat', reps: 1, weight_kg: 140, skipped: false },
      // bench-press's own test session exists but nothing was logged against it.
    ]);
    const overrides = await computeTestedOverrides(testProgram as never, meta);
    expect(overrides.map((o) => o.exerciseId)).toEqual(['back-squat']);
  });

  it('ignores skipped sets when picking the best attempt', async () => {
    listSessions.mockResolvedValue([squatDay]);
    getLogsForProgram.mockResolvedValue([
      { session_id: 's1', exercise_id: 'back-squat', reps: 1, weight_kg: 160, skipped: true },
      { session_id: 's1', exercise_id: 'back-squat', reps: 1, weight_kg: 140, skipped: false },
    ]);
    const overrides = await computeTestedOverrides(testProgram as never, { ...meta, testExerciseIds: ['back-squat'] });
    expect(overrides[0]!.value).toBe(140);
  });
});

describe('a test-week session round-trips through the same logging shape as any other producer', () => {
  it('every set carries the blockLetter/slot/exerciseId/setNumber a LoggedSetRow needs', () => {
    const week = buildTestWeek({
      program: {
        name: 'Block One', generatorVersion: 'gen-1.0.0', weeks: 4, daysPerWeek: 2, startDate: '2026-08-03',
        input: {} as never,
        plan: [{ weekNumber: 1, isDeload: false, sessions: [
          { weekNumber: 1, dayNumber: 1, weekday: 1, date: '2026-08-03', archetype: 'FB-A', title: 'Squat day',
            mainPattern: 'squat', isDeload: false, estimatedSec: 0, trimLog: [],
            blocks: [block('A', 'primer', 'goblet-squat'), block('B', 'main', 'back-squat'), block('C', 'secondary', 'walking-lunge')] },
        ] }],
      },
      testExerciseIds: ['back-squat'],
      trainingMaxes: { 'back-squat': 140 },
      startDate: '2026-08-31',
      increment: 2.5,
      paceFactor: 1,
    });

    expect(week.sessions).toHaveLength(1);
    const rows = week.sessions.flatMap((session, sessionIndex) =>
      session.blocks.flatMap((b) =>
        b.exercises.flatMap((ex) =>
          ex.sets.map((set) => ({
            sessionId: `sess-${sessionIndex}`,
            blockLetter: b.letter,
            slot: ex.slot,
            exerciseId: ex.exerciseId,
            setNumber: set.setNumber,
          })))));

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.sessionId).toBeTruthy();
      expect(row.blockLetter).toBeTruthy();
      expect(row.slot).toBeTruthy();
      expect(row.exerciseId).toBeTruthy();
      expect(row.setNumber).toBeGreaterThan(0);
    }
    // (session, block, slot, set) is unique — the same key `logSets` upserts on.
    const keys = rows.map((r) => `${r.sessionId}:${r.blockLetter}:${r.slot}:${r.setNumber}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
