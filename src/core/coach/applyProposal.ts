/**
 * The second half of this chunk's trust boundary
 * (`docs/11-COACH-PLATFORM.md §4`): the only function that can turn a
 * validated `ProposedChange` (`./tools.ts`) into a new `SessionBlock[]`.
 * Pure — no fetch, no Supabase, no Anthropic SDK. Reuses the exact checks
 * `src/core/generator`/`src/core/builder` already apply to their own
 * output rather than reinventing them: `isPermitted` from
 * `src/core/library/query.ts` for equipment/complexity, and
 * `estimateSet`/`estimateBlock` from `src/core/timeBudget.ts` for the one
 * block whose timing actually changes.
 *
 * Every violation throws a distinct `DomainError` subclass — same pattern
 * `src/core/types.ts` already established for the generator
 * (`SessionOverBudgetError`, `BalanceUnsatisfiableError`,
 * `NoSubstituteError`) — so a test can assert on the *specific* rule that
 * fired, not just that something did.
 */

import { getExercise } from '../library/exercises';
import { isPermitted, type LibraryContext } from '../library/query';
import { estimateBlock, estimateSet } from '../timeBudget';
import { DomainError } from '../types';
import type { BlockExercise, BlockKind, PrescribedSet, SessionBlock } from '../types';
import type { AdjustLoadChange, AdjustSetsChange, ProposedChange, SwapExerciseChange } from './tools';

/**
 * A structural subset of the real `SessionRow` (`@/server/repo`) — `src/core`
 * cannot import `@/server` at all (`00-CONTEXT.md §4`, enforced by
 * `eslint.config.mjs`), the same rule `context.ts`/`debrief.ts` already hit
 * and the same fix: a narrow local shape the real row satisfies without an
 * import (`DECISIONS.md`).
 */
export interface SessionForProposal {
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
  blocks: SessionBlock[];
}

export class SessionNotEditableError extends DomainError {
  constructor(details: Record<string, unknown>) {
    super('SESSION_NOT_EDITABLE', 'This session can no longer be changed by a proposal', details);
    this.name = 'SessionNotEditableError';
  }
}

export class BlockOrSlotNotFoundError extends DomainError {
  constructor(details: Record<string, unknown>) {
    super('BLOCK_OR_SLOT_NOT_FOUND', 'The targeted block or slot does not exist in this session', details);
    this.name = 'BlockOrSlotNotFoundError';
  }
}

/**
 * `01-METHODOLOGY.md §1.3`'s "never trim T1" rule, now enforced against the
 * coach specifically — not just the time-budget trimmer
 * (`src/core/timeBudget.ts`'s own `TRIM_LADDER`, which already never lists
 * the main block). Its own named class, deliberately, so a test can assert
 * on it precisely — this is the rule most worth protecting in this file.
 */
export class MainLiftProtectedError extends DomainError {
  constructor(details: Record<string, unknown>) {
    super('MAIN_LIFT_PROTECTED', 'adjust_sets can never target a main block', details);
    this.name = 'MainLiftProtectedError';
  }
}

export class UnknownExerciseError extends DomainError {
  constructor(details: Record<string, unknown>) {
    super('UNKNOWN_EXERCISE', 'The proposed exercise id does not exist in the library', details);
    this.name = 'UnknownExerciseError';
  }
}

export class ExerciseNotPermittedError extends DomainError {
  constructor(details: Record<string, unknown>) {
    super('EXERCISE_NOT_PERMITTED', 'The proposed exercise is not a valid swap for this slot', details);
    this.name = 'ExerciseNotPermittedError';
  }
}

export class SetNotFoundError extends DomainError {
  constructor(details: Record<string, unknown>) {
    super('SET_NOT_FOUND', 'The targeted set number does not exist on this exercise', details);
    this.name = 'SetNotFoundError';
  }
}

export class LoadOutOfRangeError extends DomainError {
  constructor(details: Record<string, unknown>) {
    super('LOAD_OUT_OF_RANGE', "The requested load exceeds this app's own prescribing ceiling for this tier", details);
    this.name = 'LoadOutOfRangeError';
  }
}

/**
 * The RPE ceiling this app ever prescribes, by block kind
 * (`01-METHODOLOGY.md §3`): primer/down-regulate are never loaded work
 * (RPE ≤ 4), the main lift caps at 8.5 (§3.2), secondary at 8 (§3.3,
 * "Load target: RPE 7-8"), accessory supersets at 9 (§3.4, "RPE 7-9 —
 * accessories may go close to failure"). The finisher (§3.5) has no single
 * RPE figure in the doc (a carry/trunk round isn't RPE-scored the same
 * way); it's given the same ceiling as the accessory superset rather than
 * left unbounded, since that's the highest ceiling this app defines
 * anywhere and a finisher is closer in kind to an accessory than to a main
 * lift (`DECISIONS.md`).
 */
const RPE_CEILING_BY_BLOCK_KIND: Record<BlockKind, number> = {
  primer: 4,
  main: 8.5,
  secondary: 8,
  superset: 9,
  finisher: 9,
  downregulate: 4,
};

/**
 * `%TM` ceiling. Only the main lift has one defined at all
 * (`01-METHODOLOGY.md §5.1`'s wave tables: the highest percent either wave
 * ever emits is `WAVE_6`'s peak-week top set, 88% — used here rather than
 * the doc's own rounder "87%" prose figure, since this is the actual number
 * `src/core/progression/waves.ts` can produce and a proposal must never
 * exceed what the generator itself would ever prescribe). No other tier
 * ever targets `%TM` in a generated program — a self-built routine's
 * `percent_tm` target kind (`src/core/builder/materializeRoutine.ts`) is the
 * one place a non-main exercise can carry one at all, and the methodology
 * doc defines no ceiling for that case, so only the sanity bound already in
 * `tools.ts`'s schema (0-1) applies there.
 */
const MAIN_PERCENT_TM_CEILING = 0.88;

interface Located {
  block: SessionBlock;
  exercise: BlockExercise;
}

function locate(blocks: SessionBlock[], blockLetter: string, slot: string): Located {
  const block = blocks.find((b) => b.letter === blockLetter);
  if (!block) throw new BlockOrSlotNotFoundError({ blockLetter, slot });
  const exercise = block.exercises.find((e) => e.slot === slot);
  if (!exercise) throw new BlockOrSlotNotFoundError({ blockLetter, slot });
  return { block, exercise };
}

function applySwapExercise(blocks: SessionBlock[], change: SwapExerciseChange, ctx: LibraryContext): SessionBlock[] {
  const { block, exercise } = locate(blocks, change.blockLetter, change.slot);

  const target = EXERCISE_LOOKUP(change.toExerciseId);
  if (!target) throw new UnknownExerciseError({ toExerciseId: change.toExerciseId });
  if (!isPermitted(target, ctx)) {
    throw new ExerciseNotPermittedError({ toExerciseId: change.toExerciseId, reason: 'not_permitted' });
  }
  if (target.id === exercise.exerciseId) {
    throw new ExerciseNotPermittedError({ toExerciseId: change.toExerciseId, reason: 'unchanged' });
  }

  // Cue mirrors the exercise (every `BlockExercise.cue` is a copy of its
  // `Exercise.cue` at materialization time) — carrying the old one forward
  // would show coaching text for the wrong movement. Sets, tempo and slot
  // are untouched: the athlete's rep/RPE scheme for that slot doesn't
  // change, only which movement fills it. This function's `ctx` has no
  // training maxes in scope (deliberately — see `DECISIONS.md`), so a
  // swapped-in exercise's `weightKg`/`percentTm` figures, if any, are not
  // recomputed against its own training max; they stay whatever the
  // original exercise's sets already carried.
  return blocks.map((b) => (b !== block ? b : {
    ...b,
    exercises: b.exercises.map((e) => (e !== exercise ? e : { ...e, exerciseId: target.id, cue: target.cue })),
  }));
}

/** Last-set-as-template expansion / drop-from-the-end truncation — the same shape `src/core/timeBudget.ts`'s own live `addAccessoryRound`/`dropAccessorySet` already use for the identical "resize a live session's sets" job. */
function resizeSets(sets: PrescribedSet[], target: number): PrescribedSet[] {
  if (target <= sets.length) return sets.slice(0, target);
  const last = sets[sets.length - 1];
  if (!last) return sets;
  const result = [...sets];
  while (result.length < target) result.push({ ...last, setNumber: result.length + 1 });
  return result;
}

function applyAdjustSets(blocks: SessionBlock[], change: AdjustSetsChange): SessionBlock[] {
  const { block, exercise } = locate(blocks, change.blockLetter, change.slot);
  if (block.kind === 'main') throw new MainLiftProtectedError({ blockLetter: change.blockLetter, slot: change.slot });

  // A block with `rounds` set (a superset, or the rounds-based primer) moves
  // every exercise in lockstep — `materializeDay`/the generator both give
  // every exercise in such a block the same set count, alternating by
  // round, so resizing only the named slot would desync the block. Resize
  // every exercise and `rounds` itself together; otherwise resize just the
  // one named exercise.
  const isRoundsBased = (block.rounds ?? 0) > 1;
  const nextExercises = block.exercises.map((e) => {
    if (isRoundsBased) return { ...e, sets: resizeSets(e.sets, change.sets).map((s) => ({ ...s, estimatedSec: estimateSet(s, e.tempo) })) };
    if (e !== exercise) return e;
    return { ...e, sets: resizeSets(e.sets, change.sets).map((s) => ({ ...s, estimatedSec: estimateSet(s, e.tempo) })) };
  });
  const nextBlock: SessionBlock = {
    ...block,
    ...(isRoundsBased ? { rounds: change.sets } : {}),
    exercises: nextExercises,
  };
  return blocks.map((b) => (b !== block ? b : { ...nextBlock, estimatedSec: estimateBlock(nextBlock) }));
}

function applyAdjustLoad(blocks: SessionBlock[], change: AdjustLoadChange): SessionBlock[] {
  const { block, exercise } = locate(blocks, change.blockLetter, change.slot);
  const set = exercise.sets.find((s) => s.setNumber === change.setNumber);
  if (!set) throw new SetNotFoundError({ blockLetter: change.blockLetter, slot: change.slot, setNumber: change.setNumber });

  const rpeCeiling = RPE_CEILING_BY_BLOCK_KIND[block.kind];
  if (change.rpe != null && change.rpe > rpeCeiling) {
    throw new LoadOutOfRangeError({ blockKind: block.kind, rpe: change.rpe, rpeCeiling });
  }
  if (change.percentTm != null && block.kind === 'main' && change.percentTm > MAIN_PERCENT_TM_CEILING) {
    throw new LoadOutOfRangeError({ blockKind: block.kind, percentTm: change.percentTm, percentTmCeiling: MAIN_PERCENT_TM_CEILING });
  }

  // A stale `weightKg` computed against the *old* percent would be actively
  // wrong once the percent changes — this app's own standing rule is to
  // show nothing rather than a fabricated/incorrect number (the exact
  // reasoning `resolvePercentTmSet`'s "no training max on file" fallback
  // already uses), and the player already falls back to an RPE-only display
  // whenever `weightKg` is absent (`SetRow.tsx`). Recomputing the real `kg`
  // would need the athlete's training max, which this function's `ctx` does
  // not carry (`DECISIONS.md`).
  const nextSet: PrescribedSet = {
    ...set,
    ...(change.percentTm != null ? { percentTm: change.percentTm, weightKg: undefined } : {}),
    ...(change.rpe != null ? { rpe: change.rpe } : {}),
  };

  return blocks.map((b) => (b !== block ? b : {
    ...b,
    exercises: b.exercises.map((e) => (e !== exercise ? e : {
      ...e,
      sets: e.sets.map((s) => (s !== set ? s : nextSet)),
    })),
  }));
}

const EXERCISE_LOOKUP = (id: string) => {
  try {
    return getExercise(id);
  } catch {
    return null;
  }
};

/**
 * `(current session, validated proposal, athlete's own library context) ->
 * new SessionBlock[]`, or throws one of the `DomainError` subclasses above.
 * The input is never mutated; every block/exercise/set untouched by the
 * change keeps its exact prior value (only what's targeted is replaced),
 * matching the "produce a fresh value" discipline every other `src/core`
 * function in this repo already follows.
 */
export function applyProposal(
  session: SessionForProposal,
  change: ProposedChange,
  ctx: LibraryContext,
): SessionBlock[] {
  if (session.status !== 'planned') {
    throw new SessionNotEditableError({ status: session.status });
  }

  switch (change.action) {
    case 'swap_exercise':
      return applySwapExercise(session.blocks, change, ctx);
    case 'adjust_sets':
      return applyAdjustSets(session.blocks, change);
    case 'adjust_load':
      return applyAdjustLoad(session.blocks, change);
    default: {
      const exhaustive: never = change;
      throw exhaustive;
    }
  }
}
