import { getExercise } from '@/core/library/exercises';
import type { ProposedChange } from '@/core/coach/tools';
import type { SessionBlock } from '@/core/types';

/**
 * Turns a validated `ProposedChange` plus the session it targets into
 * exactly the numbers `ProposalCard` needs to show a real diff — not a
 * repeat of the model's own prose (`docs/chunks/chunk-28-proposal.md §4`).
 * Server-side only (`/coach/page.tsx`, a Server Component): resolves
 * exercise names through the real library and reads the *current* state of
 * the targeted slot/set out of the session's own `blocks`, so what's shown
 * is always the real "before", not whatever the model said it was.
 *
 * Returns `null` when the session or the targeted block/slot can no longer
 * be found (the session was deleted, or something else edited the program
 * out from under a still-`pending` proposal since it was made) — the card
 * falls back to the proposal's own raw fields rather than crashing the
 * page; `applyProposal.ts` re-checks all of this for real at apply time
 * regardless of what this display-only helper shows.
 */

interface SessionForDiff {
  title: string;
  scheduledDate: string;
  blocks: SessionBlock[];
}

export type ProposalDiff =
  | {
      kind: 'swap_exercise';
      sessionTitle: string; sessionDate: string; blockLetter: string; slot: string;
      fromName: string; toName: string; reason: string;
    }
  | {
      kind: 'adjust_sets';
      sessionTitle: string; sessionDate: string; blockLetter: string; slot: string;
      exerciseName: string; fromSets: number; toSets: number;
    }
  | {
      kind: 'adjust_load';
      sessionTitle: string; sessionDate: string; blockLetter: string; slot: string;
      exerciseName: string; setNumber: number;
      fromPercentTm: number | null; toPercentTm: number | null;
      fromRpe: number | null; toRpe: number | null;
    };

function nameOf(exerciseId: string): string {
  try {
    return getExercise(exerciseId).name;
  } catch {
    return exerciseId;
  }
}

export function buildProposalDiff(session: SessionForDiff | null, change: ProposedChange): ProposalDiff | null {
  if (!session) return null;
  const block = session.blocks.find((b) => b.letter === change.blockLetter);
  const exercise = block?.exercises.find((e) => e.slot === change.slot);
  if (!block || !exercise) return null;

  const base = {
    sessionTitle: session.title, sessionDate: session.scheduledDate,
    blockLetter: change.blockLetter, slot: change.slot,
  };

  if (change.action === 'swap_exercise') {
    return {
      kind: 'swap_exercise', ...base,
      fromName: nameOf(exercise.exerciseId), toName: nameOf(change.toExerciseId), reason: change.reason,
    };
  }

  if (change.action === 'adjust_sets') {
    return {
      kind: 'adjust_sets', ...base,
      exerciseName: nameOf(exercise.exerciseId), fromSets: exercise.sets.length, toSets: change.sets,
    };
  }

  const set = exercise.sets.find((s) => s.setNumber === change.setNumber);
  return {
    kind: 'adjust_load', ...base,
    exerciseName: nameOf(exercise.exerciseId), setNumber: change.setNumber,
    fromPercentTm: set?.percentTm ?? null,
    toPercentTm: change.percentTm ?? set?.percentTm ?? null,
    fromRpe: set?.rpe ?? null,
    toRpe: change.rpe ?? set?.rpe ?? null,
  };
}
