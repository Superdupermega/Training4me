import { describe, expect, it } from 'vitest';
import { detectPRs } from './prs';

const set = (reps: number, weightKg: number, exerciseId = 'back-squat') => ({
  exerciseId, reps, weightKg, skipped: false,
});

describe('detectPRs', () => {
  it('finds a new estimated one-rep max', () => {
    const prs = detectPRs([set(5, 140)], []);
    expect(prs.find((p) => p.kind === 'e1rm')?.value).toBeCloseTo(163.3, 1);
  });

  it('records a heavier triple even when the estimated max does not improve', () => {
    const existing = [{ exerciseId: 'back-squat', kind: 'e1rm', value: 200 }];
    const prs = detectPRs([set(3, 160)], existing);
    expect(prs.map((p) => p.kind)).toContain('rep_max_3');
    expect(prs.map((p) => p.kind)).not.toContain('e1rm');
  });

  it('ignores skipped and unloaded sets', () => {
    expect(detectPRs([{ ...set(5, 100), skipped: true }], [])).toHaveLength(0);
    expect(detectPRs([set(0, 100), set(5, 0)], [])).toHaveLength(0);
  });

  it('keeps only the best set of the session per kind', () => {
    const prs = detectPRs([set(5, 100), set(5, 120), set(5, 110)], []);
    expect(prs.filter((p) => p.kind === 'rep_max_5')).toHaveLength(1);
    expect(prs.find((p) => p.kind === 'rep_max_5')?.value).toBe(120);
  });

  it('compares against the highest existing record, not the last one in the list', () => {
    // `existing` is an append-only history, typically most-recent first —
    // a set beating an old, lower entry that happens to sort late must
    // still not count as a PR if a higher record already stands.
    const existing = [
      { exerciseId: 'back-squat', kind: 'e1rm', value: 220 }, // most recent, highest
      { exerciseId: 'back-squat', kind: 'e1rm', value: 150 }, // oldest, lowest
    ];
    expect(detectPRs([set(1, 200)], existing)).toHaveLength(0);
    expect(detectPRs([set(1, 230)], existing).find((p) => p.kind === 'e1rm')?.value).toBeGreaterThan(220);
  });

  it('attributes a PR to the session of the set that actually won it', () => {
    const sets = [
      { ...set(5, 100), sessionId: 'session-a' },
      { ...set(5, 150), sessionId: 'session-b' },
    ];
    const pr = detectPRs(sets, []).find((p) => p.kind === 'rep_max_5');
    expect(pr?.sessionId).toBe('session-b');
  });
});
