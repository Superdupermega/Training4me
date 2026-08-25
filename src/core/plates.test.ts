import { describe, expect, it } from 'vitest';
import { availablePlatesKg, formatPlateBreakdown, plateBreakdown } from './plates';

describe('plateBreakdown', () => {
  it('loads an empty bar for a target at or below the bar weight', () => {
    expect(plateBreakdown(20)).toEqual({ perSide: [], barKg: 20, totalKg: 20, exact: true });
    expect(plateBreakdown(15).perSide).toEqual([]);
    expect(plateBreakdown(15).exact).toBe(false);
  });

  it('breaks a standard total down largest-plate-first per side', () => {
    // 102.5 = 20 (bar) + 2 * 41.25 -> per side 25+15+1.25? check greedy: 41.25 -> 25,15,1.25 remaining 0
    const b = plateBreakdown(102.5);
    expect(b.perSide).toEqual([25, 15, 1.25]);
    expect(b.totalKg).toBe(102.5);
    expect(b.exact).toBe(true);
  });

  it('handles a round number cleanly', () => {
    const b = plateBreakdown(100);
    // per side 40 -> 25 + 15
    expect(b.perSide).toEqual([25, 15]);
    expect(b.totalKg).toBe(100);
    expect(b.exact).toBe(true);
  });

  it('gets as close as possible, from below, when the exact target is unreachable', () => {
    // per side needed: 41.4 -> greedy with standard plates gets to 41.25, 0.15 short
    const b = plateBreakdown(102.8);
    expect(b.totalKg).toBeLessThanOrEqual(102.8);
    expect(b.exact).toBe(false);
  });

  it('a lighter bar and a heavier target both work', () => {
    const b = plateBreakdown(60, 15);
    // per side: 22.5 -> 20 + 2.5
    expect(b.perSide).toEqual([20, 2.5]);
    expect(b.totalKg).toBe(60);
  });

  it('micro plates close a gap the standard set cannot', () => {
    // per side needed: 40.5 — 25 + 15 leaves 0.5 unreachable without a 0.5kg plate.
    const withoutMicro = plateBreakdown(101, 20, availablePlatesKg(false));
    const withMicro = plateBreakdown(101, 20, availablePlatesKg(true));
    expect(withoutMicro.exact).toBe(false);
    expect(withMicro.exact).toBe(true);
    expect(withMicro.perSide).toEqual([25, 15, 0.5]);
  });
});

describe('formatPlateBreakdown', () => {
  it('joins plates largest first with " + "', () => {
    expect(formatPlateBreakdown(plateBreakdown(102.5))).toBe('25 + 15 + 1.25');
  });

  it('is empty for an unloaded bar', () => {
    expect(formatPlateBreakdown(plateBreakdown(20))).toBe('');
  });

  it('does not print a trailing zero on a whole-number plate', () => {
    expect(formatPlateBreakdown(plateBreakdown(100))).toBe('25 + 15');
  });
});
