import { describe, expect, it } from 'vitest';
import { isoWeekStart } from './analytics';

/**
 * The rest of `analytics.ts` is DB-touching and, consistent with the rest of
 * `src/server` (see `db.test.ts` and `exerciseContext.test.ts`'s own note),
 * has no live-query test in this project. `isoWeekStart` is the one piece
 * of pure logic worth its own test regardless: get the week boundary wrong
 * and a whole week of sets silently lands in the wrong bucket.
 */
describe('isoWeekStart', () => {
  it('a Monday maps to itself', () => {
    expect(isoWeekStart(new Date('2026-08-24T12:00:00Z'))).toBe('2026-08-24');
  });

  it('a Sunday maps back to the Monday that started its week', () => {
    expect(isoWeekStart(new Date('2026-08-30T12:00:00Z'))).toBe('2026-08-24');
  });

  it('a Tuesday maps back to the same Monday as the rest of its week', () => {
    expect(isoWeekStart(new Date('2026-08-25T23:00:00Z'))).toBe('2026-08-24');
  });

  it('crosses a month boundary correctly', () => {
    // 2026-09-01 is a Tuesday; its week started Monday 2026-08-31.
    expect(isoWeekStart(new Date('2026-09-01T00:00:00Z'))).toBe('2026-08-31');
  });
});
