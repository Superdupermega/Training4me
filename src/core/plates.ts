/**
 * Plate math. For an app whose whole thesis is a heavy barbell base, the
 * player told you `102.5 kg` and stopped — standing at the rack you want
 * "20 + 15 + 5 + 1.25 per side." See docs/07-PRODUCTION-REVIEW.md #17.
 *
 * Pure, no dependency on the profile or the DOM — the caller decides which
 * plates are actually available and whether plate math applies at all (a
 * dumbbell or machine exercise has no bar to load).
 */

/** A standard gym's plate set, in kg, largest first is not required — sorted internally. */
export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Fractional plates some gyms have and this profile's `microPlates` flag opts into. */
export const MICRO_PLATES_KG = [0.5, 0.25];

export function availablePlatesKg(microPlates: boolean): number[] {
  return microPlates ? [...STANDARD_PLATES_KG, ...MICRO_PLATES_KG] : STANDARD_PLATES_KG;
}

export const STANDARD_BAR_KG = 20;

export interface PlateBreakdown {
  /** One plate per element, heaviest first, for *one side* of the bar. */
  perSide: number[];
  barKg: number;
  /** What this breakdown actually loads the bar to — may differ from the target if it can't be hit exactly. */
  totalKg: number;
  /** True if `totalKg` matches the requested weight (within rounding noise). */
  exact: boolean;
}

/**
 * Greedy largest-plate-first breakdown for one side of the bar. Correct for
 * a standard plate set (each denomination evenly divides or is evenly
 * divisible by its neighbours), which is the only kind this is ever called
 * with — greedy is not correct in general for arbitrary denominations, but
 * proving that isn't this function's job to re-derive at call time.
 */
export function plateBreakdown(
  targetKg: number,
  barKg: number = STANDARD_BAR_KG,
  availablePlates: number[] = STANDARD_PLATES_KG,
): PlateBreakdown {
  if (targetKg <= barKg) {
    return { perSide: [], barKg, totalKg: barKg, exact: Math.abs(targetKg - barKg) < 0.01 };
  }

  const perSideTarget = (targetKg - barKg) / 2;
  const sorted = [...availablePlates].filter((p) => p > 0).sort((a, b) => b - a);

  const perSide: number[] = [];
  let remaining = perSideTarget;
  const EPS = 1e-6;
  for (const plate of sorted) {
    while (remaining + EPS >= plate) {
      perSide.push(plate);
      remaining = Math.round((remaining - plate) * 1e6) / 1e6;
    }
  }

  const totalKg = Math.round((barKg + 2 * perSide.reduce((sum, p) => sum + p, 0)) * 100) / 100;
  return { perSide, barKg, totalKg, exact: Math.abs(totalKg - targetKg) < 0.01 };
}

/** "20 + 15 + 5 + 1.25" — the plates for one side, formatted for display. Empty string for an unloaded bar. */
export function formatPlateBreakdown(breakdown: PlateBreakdown): string {
  return breakdown.perSide
    .map((p) => (Number.isInteger(p) ? String(p) : p.toFixed(2).replace(/0$/, '').replace(/\.$/, '')))
    .join(' + ');
}
