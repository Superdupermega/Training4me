import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionBlock } from '@/core/types';

const listSessions = vi.fn();
const getLogsForProgram = vi.fn();
const getProfile = vi.fn();
const getTrainingMaxes = vi.fn();
const setTrainingMaxes = vi.fn();

vi.mock('./repo', () => ({
  listSessions: (...args: unknown[]) => listSessions(...args),
  getLogsForProgram: (...args: unknown[]) => getLogsForProgram(...args),
  getProfile: (...args: unknown[]) => getProfile(...args),
  getTrainingMaxes: (...args: unknown[]) => getTrainingMaxes(...args),
  setTrainingMaxes: (...args: unknown[]) => setTrainingMaxes(...args),
}));

const { rollOverTrainingMaxes } = await import('./nextBlock');

function mainBlock(exerciseId: string): SessionBlock {
  return {
    letter: 'B', kind: 'main', name: 'Main lift', estimatedSec: 0,
    exercises: [{
      slot: 'B', exerciseId, tempo: '2010', cue: 'cue',
      sets: [
        { setNumber: 1, kind: 'ramp', reps: 5, weightKg: 50, restSec: 60, estimatedSec: 0 },
        { setNumber: 2, kind: 'top', reps: 3, weightKg: 145, restSec: 210, estimatedSec: 0 },
      ],
    }],
  };
}

function peakSession(id: string, exerciseId: string) {
  return {
    id, programId: 'p1', weekNumber: 3, dayNumber: 1, weekday: 1, scheduledDate: '2026-08-17',
    archetype: 'FB-A', title: 'Squat day', mainPattern: 'squat', isDeload: false, estimatedSec: 0,
    blocks: [mainBlock(exerciseId)], status: 'completed', startedAt: null, completedAt: null,
    actualSec: null, readiness: null, autoregulated: false, notes: null,
  };
}

const program4 = { id: 'p1', name: 'Block', weeks: 4, daysPerWeek: 3, startDate: '2026-08-03', status: 'active', input: {}, routineId: null, tmChanges: null };

function profile() {
  return {
    displayName: null, experience: 'intermediate', daysPerWeek: 3, sessionCapSec: 3600,
    equipmentProfile: 'full_gym', equipment: [], allowAdvanced: false, microPlates: false,
    bodyweightKg: 80, paceFactor: 1, preferredWeekdays: [], mesocycleWeeks: 4,
    onboardedAt: '2026-08-01T00:00:00.000Z', timezone: 'Europe/Stockholm',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getProfile.mockResolvedValue(profile());
  setTrainingMaxes.mockResolvedValue(undefined);
});

describe('rollOverTrainingMaxes', () => {
  it('returns no changes and never writes when there is no program to roll over', async () => {
    const changes = await rollOverTrainingMaxes(null);
    expect(changes).toEqual([]);
    expect(setTrainingMaxes).not.toHaveBeenCalled();
  });

  it('infers the verdict from the peak-week top set when nothing was tested', async () => {
    listSessions.mockResolvedValue([peakSession('s1', 'back-squat')]);
    getLogsForProgram.mockResolvedValue([
      { session_id: 's1', exercise_id: 'back-squat', reps: 5, rpe: 7, skipped: false },
      { session_id: 's1', exercise_id: 'back-squat', reps: 3, rpe: 7.5, skipped: false },
    ]);
    getTrainingMaxes.mockResolvedValue({ 'back-squat': 140 });

    const changes = await rollOverTrainingMaxes(program4 as never);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ exerciseId: 'back-squat', from: 140 });
    expect(changes[0]!.reason).not.toMatch(/tested/i);

    expect(setTrainingMaxes).toHaveBeenCalledTimes(2);
    const [progressedValues, progressedSource] = setTrainingMaxes.mock.calls.find((c) => c[1] === 'progressed')!;
    expect(progressedValues['back-squat']).toBe(changes[0]!.to);
    expect(progressedSource).toBe('progressed');
    const [testedValues, testedSource] = setTrainingMaxes.mock.calls.find((c) => c[1] === 'tested')!;
    expect(testedValues).toEqual({});
    expect(testedSource).toBe('tested');
  });

  it('skips inference entirely for a tested lift and writes it under source "tested"', async () => {
    listSessions.mockResolvedValue([peakSession('s1', 'back-squat')]);
    // A missed top set would normally infer a 5% reduction — proving the
    // override wins even against a bad inferred signal, not just an absent one.
    getLogsForProgram.mockResolvedValue([
      { session_id: 's1', exercise_id: 'back-squat', reps: 1, rpe: 10, skipped: false },
    ]);
    getTrainingMaxes.mockResolvedValue({ 'back-squat': 140 });

    const changes = await rollOverTrainingMaxes(program4 as never, [
      { exerciseId: 'back-squat', value: 150, reason: 'Back Squat: tested — 3 reps at 137.5 kg.' },
    ]);
    expect(changes).toEqual([{ exerciseId: 'back-squat', from: 140, to: 150, reason: 'Back Squat: tested — 3 reps at 137.5 kg.' }]);

    const [progressedValues] = setTrainingMaxes.mock.calls.find((c) => c[1] === 'progressed')!;
    expect(progressedValues).toEqual({});
    const [testedValues] = setTrainingMaxes.mock.calls.find((c) => c[1] === 'tested')!;
    expect(testedValues).toEqual({ 'back-squat': 150 });
  });

  it('still infers a lift the test week did not cover, alongside a tested one', async () => {
    listSessions.mockResolvedValue([peakSession('s1', 'back-squat'), peakSession('s2', 'bench-press')]);
    getLogsForProgram.mockResolvedValue([
      { session_id: 's1', exercise_id: 'back-squat', reps: 3, rpe: 9, skipped: false },
      { session_id: 's2', exercise_id: 'bench-press', reps: 5, rpe: 7, skipped: false },
      { session_id: 's2', exercise_id: 'bench-press', reps: 3, rpe: 7.5, skipped: false },
    ]);
    getTrainingMaxes.mockResolvedValue({ 'back-squat': 140, 'bench-press': 100 });

    const changes = await rollOverTrainingMaxes(program4 as never, [
      { exerciseId: 'back-squat', value: 150, reason: 'Back Squat: tested — 1 rep at 150 kg.' },
    ]);
    const ids = changes.map((c) => c.exerciseId).sort();
    expect(ids).toEqual(['back-squat', 'bench-press']);
    expect(changes.find((c) => c.exerciseId === 'bench-press')!.reason).not.toMatch(/tested/i);
  });

  it('drops an override for a lift with no training max on file rather than fabricating a "from"', async () => {
    listSessions.mockResolvedValue([]);
    getLogsForProgram.mockResolvedValue([]);
    getTrainingMaxes.mockResolvedValue({});

    const changes = await rollOverTrainingMaxes(program4 as never, [
      { exerciseId: 'overhead-press', value: 60, reason: 'tested' },
    ]);
    expect(changes).toEqual([]);
    const [testedValues] = setTrainingMaxes.mock.calls.find((c) => c[1] === 'tested')!;
    expect(testedValues).toEqual({});
  });
});
