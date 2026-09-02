/**
 * Turns the athlete's own still-`planned` sessions this week into a compact,
 * addressable listing for the system prompt — real `sessionId`s,
 * `blockLetter`s, `slot`s and exercise ids, not names the model has to
 * invent (`docs/11-COACH-PLATFORM.md §4`: "The model never has read access
 * of its own... grounded entirely in what the server already looked up").
 * Without this, `propose_change` (`./tools.ts`) would have nothing real to
 * target at all.
 *
 * Scoped to *this week's* `planned` sessions only, not the whole block —
 * `applyProposal.ts`'s own first check already refuses anything that isn't
 * `planned`, and bounding to one week keeps the extra prompt/cost bounded
 * the same way `sendCoachMessage`'s existing `thisWeeksSessions` scoping
 * already does for the rest of the chat context (`DECISIONS.md`). Pure —
 * no fetch, same purity rule as `context.ts`/`debrief.ts`.
 */

import { BY_ID as EXERCISES } from '@/core/library/exercises';
import type { PrescribedSet, SessionBlock } from '@/core/types';

export interface ProposableSession {
  id: string;
  title: string;
  scheduledDate: string;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
  blocks: SessionBlock[];
}

function exerciseName(id: string): string {
  return EXERCISES.get(id)?.name ?? id;
}

function summariseSet(s: PrescribedSet): string {
  const parts = [`#${s.setNumber}`];
  if (s.reps != null) parts.push(`${s.reps}${s.perSide ? '/side' : ''} reps`);
  if (s.durationSec != null) parts.push(`${s.durationSec}s`);
  if (s.distanceM != null) parts.push(`${s.distanceM}m`);
  if (s.percentTm != null) parts.push(`${Math.round(s.percentTm * 100)}% TM`);
  if (s.rpe != null) parts.push(`RPE ${s.rpe}`);
  return parts.join(' ');
}

export function buildProposalTargets(sessions: ProposableSession[]): string {
  const planned = sessions.filter((s) => s.status === 'planned');
  if (planned.length === 0) {
    return 'No planned sessions this week — there is nothing to propose a change against right now.';
  }

  return planned.map((s) => {
    const blockLines = s.blocks.flatMap((b) =>
      b.exercises.map((e) =>
        `  ${b.letter}/${e.slot} (${b.kind}): ${exerciseName(e.exerciseId)} [exerciseId: ${e.exerciseId}] — ${e.sets.map(summariseSet).join(', ')}`,
      ));
    return `Session "${s.title}" (sessionId: ${s.id}, ${s.scheduledDate}):\n${blockLines.join('\n')}`;
  }).join('\n\n');
}
