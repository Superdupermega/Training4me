import { describe, expect, it } from 'vitest';
import { buildBlockRetrospective, type RetrospectiveLoggedSet, type RetrospectiveSession } from './retrospective';

function session(overrides: Partial<RetrospectiveSession> = {}): RetrospectiveSession {
  return {
    id: 's1', weekNumber: 1, status: 'completed', isDeload: false, mainPattern: 'squat',
    blocks: [{
      kind: 'main',
      exercises: [{
        exerciseId: 'back-squat',
        sets: [
          { kind: 'ramp' }, { kind: 'working' }, { kind: 'working' },
        ],
      }],
    }],
    ...overrides,
  };
}

function loggedSet(overrides: Partial<RetrospectiveLoggedSet> = {}): RetrospectiveLoggedSet {
  return { sessionId: 's1', exerciseId: 'back-squat', reps: 5, weightKg: 100, skipped: false, ...overrides };
}

describe('buildBlockRetrospective', () => {
  it('sums tonnage from non-skipped logged sets only', () => {
    const out = buildBlockRetrospective({
      sessions: [session()],
      loggedSets: [
        loggedSet({ weightKg: 100, reps: 5 }),
        loggedSet({ weightKg: 100, reps: 5 }),
        loggedSet({ weightKg: 50, reps: 10, skipped: true }),
      ],
      prs: [], tmChanges: [],
    });
    expect(out.tonnageKg).toBe(1000);
    expect(out.setsLogged).toBe(2);
  });

  it('counts planned sets from the prescription, excluding ramp sets', () => {
    const out = buildBlockRetrospective({
      sessions: [session()], loggedSets: [], prs: [], tmChanges: [],
    });
    // Two `working` sets in the fixture's one exercise; the `ramp` set is excluded.
    expect(out.setsPlanned).toBe(2);
  });

  it('computes adherence as completed / total sessions, and handles a block with none', () => {
    const out = buildBlockRetrospective({
      sessions: [
        session({ id: 's1', status: 'completed' }),
        session({ id: 's2', status: 'skipped' }),
        session({ id: 's3', status: 'completed' }),
      ],
      loggedSets: [], prs: [], tmChanges: [],
    });
    expect(out.sessionsCompleted).toBe(2);
    expect(out.sessionsSkipped).toBe(1);
    expect(out.sessionsTotal).toBe(3);
    expect(out.adherence).toBeCloseTo(2 / 3, 5);

    const empty = buildBlockRetrospective({ sessions: [], loggedSets: [], prs: [], tmChanges: [] });
    expect(empty.adherence).toBe(0);
    expect(empty.sessionsTotal).toBe(0);
  });

  it('finds the heaviest completed set of the main lift in the peak (heaviest non-deload) week', () => {
    const out = buildBlockRetrospective({
      sessions: [
        session({ id: 's1', weekNumber: 1, isDeload: false }),
        session({ id: 's2', weekNumber: 3, isDeload: false }),
        session({ id: 's3', weekNumber: 4, isDeload: true }), // deload — excluded even though it's the highest number
      ],
      loggedSets: [
        loggedSet({ sessionId: 's1', weightKg: 100, reps: 5 }),
        loggedSet({ sessionId: 's2', weightKg: 110, reps: 3 }),
        loggedSet({ sessionId: 's2', weightKg: 105, reps: 5 }), // lighter set, same session — the 110 wins
        loggedSet({ sessionId: 's3', weightKg: 60, reps: 8 }),
      ],
      prs: [], tmChanges: [],
    });
    expect(out.peakWeekTopSets).toEqual([{ exerciseId: 'back-squat', weightKg: 110, reps: 3 }]);
  });

  it('skips a peak-week session that was not actually completed', () => {
    const out = buildBlockRetrospective({
      sessions: [session({ id: 's1', weekNumber: 3, status: 'skipped' })],
      loggedSets: [loggedSet({ sessionId: 's1', weightKg: 100, reps: 5 })],
      prs: [], tmChanges: [],
    });
    expect(out.peakWeekTopSets).toEqual([]);
  });

  it('keeps only PRs whose session belongs to this block', () => {
    const out = buildBlockRetrospective({
      sessions: [session({ id: 's1' })],
      loggedSets: [],
      prs: [
        { exerciseId: 'back-squat', kind: 'e1rm', value: 120, reps: 5, weightKg: 100, achievedAt: '2026-08-01', sessionId: 's1' },
        { exerciseId: 'bench-press', kind: 'e1rm', value: 80, reps: 5, weightKg: 70, achievedAt: '2026-07-01', sessionId: 'other-block-session' },
      ],
      tmChanges: [],
    });
    expect(out.prs).toHaveLength(1);
    expect(out.prs[0]!.exerciseId).toBe('back-squat');
  });

  it('carries the TM changes array straight through, unmodified', () => {
    const changes = [{ exerciseId: 'back-squat', from: 140, to: 145, reason: 'all reps at RPE 8, full jump' }];
    const out = buildBlockRetrospective({
      sessions: [], loggedSets: [], prs: [], tmChanges: changes,
    });
    expect(out.tmChanges).toBe(changes);
  });

  it('handles a block with zero logged sets', () => {
    const out = buildBlockRetrospective({
      sessions: [session({ status: 'planned' })], loggedSets: [], prs: [], tmChanges: [],
    });
    expect(out.tonnageKg).toBe(0);
    expect(out.setsLogged).toBe(0);
    expect(out.sessionsCompleted).toBe(0);
  });

  it('handles a block where no TM moved', () => {
    const out = buildBlockRetrospective({ sessions: [session()], loggedSets: [], prs: [], tmChanges: [] });
    expect(out.tmChanges).toEqual([]);
  });
});
