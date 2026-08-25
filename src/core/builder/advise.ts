import type { BalanceViolation } from '../generator/balance';
import { validateWeek } from '../generator/balance';
import { PROFILE_EQUIPMENT } from '../library/equipment';
import type { LibraryContext } from '../library/query';
import type { PlannedWeek } from '../types';

/**
 * Advisory only — never blocks a save, never auto-repairs
 * (docs/06-REDESIGN-PLAN.md chunk 18 §6: "warn, never overrule"). This is
 * deliberately just the generator's own read-only `validateWeek` in `'full'`
 * mode, reused rather than reimplemented, run against a permissive library
 * context: the point is "this week looks push-heavy", not gating on the
 * athlete's actual equipment (their own item picks already did that).
 */
const PERMISSIVE_CTX: LibraryContext = {
  equipment: PROFILE_EQUIPMENT.full_gym, painFlags: [], allowAdvanced: true,
};

export function adviseOnWeek(week: PlannedWeek, daysPerWeek: number): BalanceViolation[] {
  return validateWeek(week, daysPerWeek, PERMISSIVE_CTX, 'full');
}
