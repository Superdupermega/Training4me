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
});
