import type { PlannedSession, PlannedWeek } from '../types';

/**
 * What a program's sessions look like from the outside, stripped to what
 * deciding *this* needs: no blocks, no dates, no database.
 */
export interface ExistingSession {
  id: string;
  weekNumber: number;
  dayNumber: number;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
  /** True if any set has ever been logged against it. */
  hasLoggedSets: boolean;
}

export interface Reconciliation {
  /** Sessions to delete and re-materialise — the plan, not the history. */
  replaceIds: string[];
  /** Sessions to leave exactly as they are. */
  kept: ExistingSession[];
  /** The new plan, minus every slot a kept session already occupies. */
  insert: PlannedSession[];
  /** What the program's `weeks` should say afterwards. */
  weeks: number;
}

const slot = (weekNumber: number, dayNumber: number) => `${weekNumber}:${dayNumber}`;

/**
 * Editing a program you are in the middle of training: which of its sessions
 * may be rewritten from the edited routine, and which are history and must
 * survive untouched.
 *
 * A session is history the moment it stops being a pure plan — started,
 * finished, deliberately skipped, or holding logged sets (which a session
 * still marked `planned` can, when a set arrives out of the offline outbox
 * after `beginSession` failed). Everything else is just a prediction of what
 * you will do, and a prediction is exactly what an edit is allowed to change.
 *
 * `(week, day)` is unique per program, so a slot a kept session sits in is
 * one the new plan must skip rather than collide with: shrink a routine from
 * four days to three mid-block and last week's fourth session stays put,
 * with no fourth day scheduled ahead of you.
 */
export function reconcileProgram(
  plan: PlannedWeek[], existing: ExistingSession[], routineWeeks: number,
): Reconciliation {
  const replaceable = existing.filter((s) => s.status === 'planned' && !s.hasLoggedSets);
  const replaceIds = new Set(replaceable.map((s) => s.id));
  const kept = existing.filter((s) => !replaceIds.has(s.id));
  const taken = new Set(kept.map((s) => slot(s.weekNumber, s.dayNumber)));

  const insert = plan
    .flatMap((week) => week.sessions)
    .filter((s) => !taken.has(slot(s.weekNumber, s.dayNumber)));

  return {
    replaceIds: [...replaceIds],
    kept,
    insert,
    // The block can grow to fit the edited routine but never shrinks below
    // the weeks already trained — those sessions still have to be reachable
    // on /program, whatever the routine now says.
    weeks: Math.max(routineWeeks, ...kept.map((s) => s.weekNumber), 1),
  };
}
