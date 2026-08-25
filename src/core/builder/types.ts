import type { BlockKind } from '../types';

/**
 * Domain shape for a user-built routine — mirrors `t4m_routine` /
 * `t4m_routine_day` / `t4m_routine_item` (see the migration in
 * `docs/06-REDESIGN-PLAN.md` chunk 18 §2), the way `src/core/types.ts`
 * mirrors the generator's tables. Server code maps between the two;
 * `src/core` itself never imports from `@/server`.
 */

export type TargetKind = 'percent_tm' | 'rpe' | 'weight' | 'bodyweight' | 'duration' | 'distance';

export interface RoutineItem {
  id: string;
  position: number;
  blockLetter: string;
  blockKind: BlockKind;
  /** Items sharing a non-null group *and* block letter become one superset block. */
  supersetGroup: string | null;
  exerciseId: string;
  sets: number;
  repLo: number | null;
  repHi: number | null;
  tempo: string;
  restSec: number;
  targetKind: TargetKind;
  percentTm: number | null;
  rpe: number | null;
  weightKg: number | null;
  durationSec: number | null;
  distanceM: number | null;
  perSide: boolean;
  notes: string | null;
}

export interface RoutineDay {
  id: string;
  dayIndex: number;
  name: string;
  /** 1 = Monday. Falls back to sequential placement when not set. */
  weekday: number | null;
  notes: string | null;
  items: RoutineItem[];
}

export interface Routine {
  id: string;
  name: string;
  description: string | null;
  weeks: number;
  daysPerWeek: number;
  days: RoutineDay[];
}
