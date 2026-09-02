/**
 * Turns one already-finished session's own rows into the compact factual
 * paragraph a debrief's system prompt is grounded in — the session-scoped
 * sibling of `context.ts`'s `buildCoachContext`
 * (`docs/chunks/chunk-27-debrief.md §1`). Same purity rule and the same
 * reason for it: `src/core` may not depend on `@/server` at all
 * (`00-CONTEXT.md §4`, enforced by `eslint.config.mjs`), so the shapes below
 * are narrow structural subsets of the real `SessionRow`/`LoggedSetRow`/`Pr`
 * rows, satisfied by them without an import — `context.ts` and
 * `src/core/progression/retrospective.ts` already establish this pattern.
 * `SessionBlock` itself is a genuine `src/core` type (`@/core/types`), so it
 * is imported directly rather than re-shaped.
 */

import { BY_ID as EXERCISES } from '@/core/library/exercises';
import type { SessionBlock } from '@/core/types';

export interface DebriefSession {
  title: string;
  weekNumber: number;
  isDeload: boolean;
  mainPattern: string | null;
  estimatedSec: number;
  actualSec: number | null;
  /** RPE >= 9.5 auto-back-off fired at some point during this session. */
  autoregulated: boolean;
  blocks: SessionBlock[];
}

export interface DebriefLoggedSet {
  reps: number | null;
  weightKg: number | null;
  skipped: boolean;
}

export interface DebriefPr {
  exerciseId: string;
  kind: 'e1rm' | 'rep_max_3' | 'rep_max_5' | 'best_set';
  value: number;
  reps: number | null;
  weightKg: number | null;
}

export interface DebriefPreviousSession {
  scheduledDate: string;
}

const PR_KIND_LABEL: Record<DebriefPr['kind'], string> = {
  e1rm: 'estimated 1RM',
  rep_max_3: '3-rep max',
  rep_max_5: '5-rep max',
  best_set: 'best set',
};

/** Display name for an exercise id, falling back to the id itself for a stale/unknown one rather than throwing. */
function exerciseName(id: string): string {
  return EXERCISES.get(id)?.name ?? id;
}

function fmtKg(kg: number): string {
  return `${Math.round(kg * 10) / 10} kg`;
}

export function buildDebriefContext(input: {
  session: DebriefSession;
  loggedSets: DebriefLoggedSet[];
  prs: DebriefPr[];
  previousSessionsSamePattern: DebriefPreviousSession[];
}): string {
  const { session, loggedSets, prs, previousSessionsSamePattern } = input;
  const lines: string[] = [];

  lines.push(
    `Session: "${session.title}", week ${session.weekNumber}${session.isDeload ? ' (deload week)' : ''}.`,
  );

  // Prescribed vs. logged — every non-ramp set across every block, the same
  // filter SessionSummary's own `totals` and `retrospective.ts`'s
  // `setsPlanned` already use.
  const setsPlanned = session.blocks.reduce((total, block) =>
    total + block.exercises.reduce((exTotal, ex) =>
      exTotal + ex.sets.filter((s) => s.kind !== 'ramp').length, 0), 0);

  const loggedNotSkipped = loggedSets.filter((s) => !s.skipped);
  const setsLogged = loggedNotSkipped.length;
  const setsSkipped = loggedSets.filter((s) => s.skipped).length;

  if (setsPlanned > 0) {
    lines.push(
      `${setsLogged} of ${setsPlanned} prescribed sets were completed`
      + (setsSkipped > 0 ? `, ${setsSkipped} explicitly marked skipped` : '') + '.',
    );
  }
  if (setsLogged === 0) {
    lines.push('No sets were logged at all — this session looks like it was skipped in full.');
  }

  const tonnageKg = loggedNotSkipped.reduce((total, s) =>
    total + (s.weightKg != null && s.reps != null ? s.weightKg * s.reps : 0), 0);
  if (tonnageKg > 0) {
    lines.push(`Total tonnage logged: ${fmtKg(tonnageKg)}.`);
  }

  if (session.actualSec != null) {
    lines.push(
      `Took ${Math.round(session.actualSec / 60)} minutes (estimated ${Math.round(session.estimatedSec / 60)}).`,
    );
  }

  if (session.autoregulated) {
    lines.push('An RPE 9.5+ set triggered an automatic load back-off partway through the session.');
  }

  if (prs.length > 0) {
    const items = prs.map((pr) => {
      const load = pr.weightKg != null
        ? `${fmtKg(pr.weightKg)}${pr.reps ? ` x ${pr.reps}` : ''}`
        : pr.reps ? `${pr.reps} reps` : `${pr.value}`;
      return `${exerciseName(pr.exerciseId)} ${PR_KIND_LABEL[pr.kind]}: ${load}`;
    });
    lines.push(`New PR${prs.length > 1 ? 's' : ''} this session: ${items.join('; ')}.`);
  }

  if (session.mainPattern && previousSessionsSamePattern.length > 0) {
    const mostRecent = previousSessionsSamePattern
      .reduce((latest, s) => (s.scheduledDate > latest.scheduledDate ? s : latest));
    lines.push(
      `Not the first ${session.mainPattern} session — ${previousSessionsSamePattern.length} earlier `
      + `one${previousSessionsSamePattern.length > 1 ? 's' : ''} on record, most recently ${mostRecent.scheduledDate}.`,
    );
  }

  return lines.join('\n');
}
