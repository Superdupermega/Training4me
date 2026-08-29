import { describe, expect, it } from 'vitest';
import type { PlannedSession, PlannedWeek } from '../types';
import { reconcileProgram, type ExistingSession } from './reconcileProgram';

function planned(weekNumber: number, dayNumber: number): PlannedSession {
  return {
    weekNumber, dayNumber, weekday: dayNumber, date: '2026-09-01', archetype: 'CUSTOM',
    title: `W${weekNumber}D${dayNumber}`, mainPattern: null, isDeload: false,
    blocks: [], estimatedSec: 0, trimLog: [],
  };
}

/** `weeks` weeks of `days` days, the shape materializeRoutine hands back. */
function plan(weeks: number, days: number): PlannedWeek[] {
  return Array.from({ length: weeks }, (_, w) => ({
    weekNumber: w + 1, isDeload: false,
    sessions: Array.from({ length: days }, (_, d) => planned(w + 1, d + 1)),
  }));
}

function existing(overrides: Partial<ExistingSession> & { id: string }): ExistingSession {
  return {
    weekNumber: 1, dayNumber: 1, status: 'planned', hasLoggedSets: false, ...overrides,
  };
}

describe('reconcileProgram', () => {
  it('rewrites the sessions still ahead and leaves everything already trained alone', () => {
    const result = reconcileProgram(plan(2, 2), [
      existing({ id: 'w1d1', weekNumber: 1, dayNumber: 1, status: 'completed' }),
      existing({ id: 'w1d2', weekNumber: 1, dayNumber: 2, status: 'skipped' }),
      existing({ id: 'w2d1', weekNumber: 2, dayNumber: 1 }),
      existing({ id: 'w2d2', weekNumber: 2, dayNumber: 2 }),
    ], 2);

    expect(result.replaceIds).toEqual(['w2d1', 'w2d2']);
    expect(result.kept.map((s) => s.id)).toEqual(['w1d1', 'w1d2']);
    // Only week 2 is re-materialised: week 1's slots are taken by history.
    expect(result.insert.map((s) => `${s.weekNumber}:${s.dayNumber}`)).toEqual(['2:1', '2:2']);
  });

  it('never rewrites the session being trained right now', () => {
    const result = reconcileProgram(plan(1, 2), [
      existing({ id: 'live', weekNumber: 1, dayNumber: 1, status: 'in_progress' }),
      existing({ id: 'later', weekNumber: 1, dayNumber: 2 }),
    ], 1);

    expect(result.replaceIds).toEqual(['later']);
    expect(result.insert.map((s) => s.dayNumber)).toEqual([2]);
  });

  it('keeps a still-"planned" session that has logged sets against it', () => {
    // The offline outbox can land sets on a session whose `beginSession`
    // never made it to the server. Deleting the row would cascade those
    // sets away — the one thing this must never do.
    const result = reconcileProgram(plan(1, 1), [
      existing({ id: 'ghost', weekNumber: 1, dayNumber: 1, hasLoggedSets: true }),
    ], 1);

    expect(result.replaceIds).toEqual([]);
    expect(result.kept.map((s) => s.id)).toEqual(['ghost']);
    expect(result.insert).toEqual([]);
  });

  it('skips a slot a kept session occupies when the routine loses a day', () => {
    // Four days down to three, mid-block: last week's fourth session stays,
    // and no fourth day is scheduled ahead.
    const result = reconcileProgram(plan(2, 3), [
      existing({ id: 'w1d4', weekNumber: 1, dayNumber: 4, status: 'completed' }),
      existing({ id: 'w2d4', weekNumber: 2, dayNumber: 4 }),
    ], 2);

    expect(result.kept.map((s) => s.id)).toEqual(['w1d4']);
    expect(result.replaceIds).toEqual(['w2d4']);
    expect(result.insert.map((s) => `${s.weekNumber}:${s.dayNumber}`))
      .toEqual(['1:1', '1:2', '1:3', '2:1', '2:2', '2:3']);
  });

  it('grows the block to fit the routine but never shrinks it below what is trained', () => {
    expect(reconcileProgram(plan(6, 1), [], 6).weeks).toBe(6);
    expect(reconcileProgram(plan(2, 1), [
      existing({ id: 'w4', weekNumber: 4, status: 'completed' }),
    ], 2).weeks).toBe(4);
  });

  it('is a plain full schedule when nothing has been trained yet', () => {
    const result = reconcileProgram(plan(4, 3), [
      existing({ id: 'a', weekNumber: 1, dayNumber: 1 }),
    ], 4);

    expect(result.replaceIds).toEqual(['a']);
    expect(result.kept).toEqual([]);
    expect(result.insert).toHaveLength(12);
  });
});
