import { describe, expect, it } from 'vitest';
import { estimateSet, fitToBudget, recost } from './timeBudget';
import { SessionOverBudgetError, type PlannedSession, type SessionBlock } from './types';

const set = (over: Partial<Parameters<typeof estimateSet>[0]> = {}) => ({
  setNumber: 1, kind: 'working' as const, reps: 5, restSec: 180, estimatedSec: 0, ...over,
});

const block = (over: Partial<SessionBlock>): SessionBlock => ({
  letter: 'B', kind: 'main', name: 'Main', exercises: [], estimatedSec: 0, ...over,
});

const session = (blocks: SessionBlock[], isDeload = false): PlannedSession => ({
  weekNumber: 1, dayNumber: 1, weekday: 1, date: '2026-08-24', archetype: 'FB-A',
  title: 'Test', mainPattern: 'squat', isDeload, blocks, estimatedSec: 0, trimLog: [],
});

describe('estimateSet', () => {
  it('costs reps at the tempo plus the rest', () => {
    // 5 reps x 4s (20X1) = 20s work, plus 180s rest.
    expect(estimateSet(set(), '20X1')).toBe(200);
  });

  it('doubles the work for per-side sets', () => {
    expect(estimateSet(set({ perSide: true }), '20X1')).toBe(220);
  });

  it('costs carries by distance and aerobic work by its duration', () => {
    expect(estimateSet(set({ reps: undefined, distanceM: 30, restSec: 60 }), '20X1')).toBe(96);
    expect(estimateSet(set({ reps: undefined, durationSec: 300, restSec: 0 }), '20X1')).toBe(300);
  });

  it('applies a floor so a one-rep set is not free', () => {
    expect(estimateSet(set({ reps: 1, restSec: 0 }), '20X1')).toBe(8);
  });
});

describe('fitToBudget', () => {
  const main = block({
    exercises: [{ slot: 'B', exerciseId: 'back-squat', tempo: '20X1', cue: '',
      sets: Array.from({ length: 4 }, () => set()) }],
  });
  const secondary = block({ letter: 'C', kind: 'secondary', name: 'Secondary',
    exercises: [{ slot: 'C', exerciseId: 'db-bench-press', tempo: '30X1', cue: '',
      sets: Array.from({ length: 4 }, () => set({ reps: 10, restSec: 90 })) }] });
  const accessory = block({ letter: 'D', kind: 'superset', name: 'Accessory', rounds: 4,
    exercises: [
      { slot: 'D1', exerciseId: 'face-pull', tempo: '20X1', cue: '', sets: Array.from({ length: 4 }, () => set({ reps: 15, restSec: 0 })) },
      { slot: 'D2', exerciseId: 'db-curl', tempo: '20X1', cue: '', sets: Array.from({ length: 4 }, () => set({ reps: 15, restSec: 60 })) },
    ] });

  it('trims accessories before secondary work', () => {
    const fitted = fitToBudget(session([main, secondary, accessory]), 1800);
    expect(fitted.estimatedSec).toBeLessThanOrEqual(1800);
    expect(fitted.trimLog[0]).toContain('accessory');
  });

  it('never trims the main lift, and says so when the cap is impossible', () => {
    const huge = block({
      exercises: [{ slot: 'B', exerciseId: 'back-squat', tempo: '20X1', cue: '',
        sets: Array.from({ length: 10 }, () => set({ restSec: 300 })) }],
    });
    expect(() => fitToBudget(session([huge]), 600)).toThrow(SessionOverBudgetError);
    const fitted = fitToBudget(session([huge, accessory]), 4200);
    const mainSets = fitted.blocks.find((b) => b.kind === 'main')!.exercises[0]!.sets;
    expect(mainSets).toHaveLength(10);
  });

  it('pads a short session back up, but never a deload', () => {
    const short = session([main]);
    const padded = fitToBudget(short, 3600);
    expect(padded.estimatedSec).toBe(recost(short).estimatedSec); // nothing to pad without accessories

    const withAccessory = session([main, { ...accessory, rounds: 2, exercises: accessory.exercises.map((e) => ({ ...e, sets: e.sets.slice(0, 2) })) }]);
    expect(fitToBudget(withAccessory, 3600).trimLog).toContain('added an accessory round');
    expect(fitToBudget({ ...withAccessory, isDeload: true }, 3600).trimLog).not.toContain('added an accessory round');
  });

  it('makes slow movers train shorter sessions', () => {
    const s = session([main, secondary, accessory]);
    expect(recost(s, 1.3).estimatedSec).toBeGreaterThan(recost(s, 1).estimatedSec);
  });
});
