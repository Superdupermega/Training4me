import { describe, expect, it } from 'vitest';
import type { LibraryContext } from '../library/query';
import type { SessionBlock } from '../types';
import {
  applyProposal,
  BlockOrSlotNotFoundError,
  ExerciseNotPermittedError,
  LoadOutOfRangeError,
  MainLiftProtectedError,
  SessionNotEditableError,
  SetNotFoundError,
  UnknownExerciseError,
  type SessionForProposal,
} from './applyProposal';
import type { ProposedChange } from './tools';

const FULL_GYM_CTX: LibraryContext = {
  equipment: ['barbell', 'rack', 'bench', 'dumbbell', 'kettlebell', 'pullup_bar', 'cable', 'bands', 'none'],
  painFlags: [],
  allowAdvanced: false,
};

function fixtureBlocks(): SessionBlock[] {
  return [
    {
      letter: 'A', kind: 'main', name: 'Back Squat', estimatedSec: 900,
      exercises: [{
        slot: 'A', exerciseId: 'back-squat', tempo: '20X1', cue: 'Brace.',
        sets: [
          { setNumber: 1, kind: 'ramp', reps: 5, weightKg: 60, restSec: 60, estimatedSec: 45 },
          { setNumber: 2, kind: 'working', reps: 5, weightKg: 100, percentTm: 0.75, rpe: 8.0, restSec: 180, estimatedSec: 120 },
          { setNumber: 3, kind: 'working', reps: 5, weightKg: 100, percentTm: 0.75, rpe: 8.0, restSec: 180, estimatedSec: 120 },
        ],
      }],
    },
    {
      letter: 'C', kind: 'secondary', name: 'Single-Arm DB Row', estimatedSec: 400,
      exercises: [{
        slot: 'C', exerciseId: 'single-arm-db-row', tempo: '30X1', cue: 'Pull to the hip, let the shoulder blade travel.',
        sets: [
          { setNumber: 1, kind: 'working', reps: 8, rpe: 7.5, restSec: 90, estimatedSec: 80 },
          { setNumber: 2, kind: 'working', reps: 8, rpe: 7.5, restSec: 90, estimatedSec: 80 },
          { setNumber: 3, kind: 'working', reps: 8, rpe: 7.5, restSec: 90, estimatedSec: 80 },
        ],
      }],
    },
    {
      letter: 'D', kind: 'superset', name: 'Accessory superset', rounds: 3, estimatedSec: 500,
      exercises: [
        {
          slot: 'D1', exerciseId: 'face-pull', tempo: '30X0', cue: 'Pull to the forehead, thumbs back, slow return.',
          sets: [
            { setNumber: 1, kind: 'working', reps: 15, rpe: 8, restSec: 0, estimatedSec: 40 },
            { setNumber: 2, kind: 'working', reps: 15, rpe: 8, restSec: 0, estimatedSec: 40 },
            { setNumber: 3, kind: 'working', reps: 15, rpe: 8, restSec: 0, estimatedSec: 40 },
          ],
        },
        {
          slot: 'D2', exerciseId: 'band-row', tempo: '30X0', cue: 'Squeeze for a beat at the back.',
          sets: [
            { setNumber: 1, kind: 'working', reps: 15, rpe: 8, restSec: 45, estimatedSec: 40 },
            { setNumber: 2, kind: 'working', reps: 15, rpe: 8, restSec: 45, estimatedSec: 40 },
            { setNumber: 3, kind: 'working', reps: 15, rpe: 8, restSec: 45, estimatedSec: 40 },
          ],
        },
      ],
    },
  ];
}

function planned(blocks: SessionBlock[] = fixtureBlocks()): SessionForProposal {
  return { status: 'planned', blocks };
}

const SESSION_ID = 'a1b2c3d4-e5f6-4789-9abc-def012345678';

function swap(overrides: Partial<Extract<ProposedChange, { action: 'swap_exercise' }>> = {}): ProposedChange {
  return {
    action: 'swap_exercise', sessionId: SESSION_ID, blockLetter: 'C', slot: 'C',
    toExerciseId: 'chest-supported-db-row', reason: 'Same pattern, easier to load progressively.',
    ...overrides,
  };
}

function adjustSets(overrides: Partial<Extract<ProposedChange, { action: 'adjust_sets' }>> = {}): ProposedChange {
  return { action: 'adjust_sets', sessionId: SESSION_ID, blockLetter: 'C', slot: 'C', sets: 4, ...overrides };
}

function adjustLoad(overrides: Partial<Extract<ProposedChange, { action: 'adjust_load' }>> = {}): ProposedChange {
  return { action: 'adjust_load', sessionId: SESSION_ID, blockLetter: 'A', slot: 'A', setNumber: 2, ...overrides };
}

describe('applyProposal', () => {
  it('refuses on a non-planned session', () => {
    const session: SessionForProposal = { status: 'in_progress', blocks: fixtureBlocks() };
    expect(() => applyProposal(session, swap(), FULL_GYM_CTX)).toThrow(SessionNotEditableError);
  });

  it('refuses adjust_sets against a main block, unconditionally — this is the rule most worth protecting', () => {
    expect(() => applyProposal(planned(), adjustSets({ blockLetter: 'A', slot: 'A', sets: 2 }), FULL_GYM_CTX))
      .toThrow(MainLiftProtectedError);
    // Even a "generous" request (more sets, not fewer) is refused just the same — this is never about the number.
    expect(() => applyProposal(planned(), adjustSets({ blockLetter: 'A', slot: 'A', sets: 6 }), FULL_GYM_CTX))
      .toThrow(MainLiftProtectedError);
  });

  it('refuses a swap to a non-existent exercise id', () => {
    expect(() => applyProposal(planned(), swap({ toExerciseId: 'not-a-real-exercise' }), FULL_GYM_CTX))
      .toThrow(UnknownExerciseError);
  });

  it("refuses a swap to an exercise the athlete's ctx doesn't permit (wrong equipment)", () => {
    const ctxNoCable: LibraryContext = { equipment: ['dumbbell', 'bench', 'none'], painFlags: [], allowAdvanced: false };
    // cable-row needs `cable`, absent from this context's equipment.
    expect(() => applyProposal(planned(), swap({ toExerciseId: 'cable-row' }), ctxNoCable))
      .toThrow(ExerciseNotPermittedError);
  });

  it('refuses a swap to an advanced-complexity exercise without allowAdvanced', () => {
    // Weighted chin-up is `complexity: 'moderate'`, permitted; a real
    // `advanced`+`skillGated` movement (chunk 16's own invariant: always
    // `inGeneratorPool: false` too) is refused the same way an unknown
    // exercise would be reachable at all through this check — either way,
    // `isPermitted` is the single gate, reused not re-derived.
    expect(() => applyProposal(planned(), swap({ toExerciseId: 'pistol-squat' }), FULL_GYM_CTX))
      .toThrow(ExerciseNotPermittedError);
  });

  it('refuses a swap to the exercise already in that slot', () => {
    expect(() => applyProposal(planned(), swap({ toExerciseId: 'single-arm-db-row' }), FULL_GYM_CTX))
      .toThrow(ExerciseNotPermittedError);
  });

  it('refuses a block or slot that does not exist', () => {
    expect(() => applyProposal(planned(), swap({ blockLetter: 'Z' }), FULL_GYM_CTX))
      .toThrow(BlockOrSlotNotFoundError);
    expect(() => applyProposal(planned(), swap({ blockLetter: 'C', slot: 'C9' }), FULL_GYM_CTX))
      .toThrow(BlockOrSlotNotFoundError);
  });

  it('refuses adjust_load against a set number that does not exist on that exercise', () => {
    expect(() => applyProposal(planned(), adjustLoad({ setNumber: 99 }), FULL_GYM_CTX))
      .toThrow(SetNotFoundError);
  });

  it('refuses an out-of-range adjust_load: percent past the main lift ceiling', () => {
    expect(() => applyProposal(planned(), adjustLoad({ percentTm: 0.95 }), FULL_GYM_CTX))
      .toThrow(LoadOutOfRangeError);
  });

  it('refuses an out-of-range adjust_load: RPE past this tier\'s ceiling', () => {
    // Main lift caps at 8.5 (01-METHODOLOGY.md §3.2).
    expect(() => applyProposal(planned(), adjustLoad({ rpe: 9.5 }), FULL_GYM_CTX))
      .toThrow(LoadOutOfRangeError);
    // Secondary (T2) caps at 8 (§3.3) — a value the main lift would allow is
    // still refused here, proving the ceiling is genuinely per-block-kind.
    expect(() => applyProposal(
      planned(), adjustLoad({ blockLetter: 'C', slot: 'C', setNumber: 1, rpe: 8.5 }), FULL_GYM_CTX,
    )).toThrow(LoadOutOfRangeError);
  });

  it('a valid swap_exercise produces a new SessionBlock[] with exactly that exercise\'s id and cue changed', () => {
    const before = planned();
    const result = applyProposal(before, swap(), FULL_GYM_CTX);

    expect(result).not.toBe(before.blocks);
    const changedBlock = result.find((b) => b.letter === 'C')!;
    expect(changedBlock.exercises[0]!.exerciseId).toBe('chest-supported-db-row');
    expect(changedBlock.exercises[0]!.cue).not.toBe('Pull to the hip, let the shoulder blade travel.');
    // Everything else about that exercise — tempo, slot, sets — is untouched.
    expect(changedBlock.exercises[0]!.tempo).toBe('30X1');
    expect(changedBlock.exercises[0]!.sets).toEqual(before.blocks.find((b) => b.letter === 'C')!.exercises[0]!.sets);
    // Every other block is the exact same reference — nothing else was touched at all.
    expect(result.find((b) => b.letter === 'A')).toBe(before.blocks.find((b) => b.letter === 'A'));
    expect(result.find((b) => b.letter === 'D')).toBe(before.blocks.find((b) => b.letter === 'D'));
    // The input itself was never mutated.
    expect(before.blocks.find((b) => b.letter === 'C')!.exercises[0]!.exerciseId).toBe('single-arm-db-row');
  });

  it('a valid adjust_sets on a plain (non-superset) block resizes just that exercise and recomputes its block total', () => {
    const before = planned();
    const result = applyProposal(before, adjustSets({ sets: 5 }), FULL_GYM_CTX);

    const changed = result.find((b) => b.letter === 'C')!;
    expect(changed.exercises[0]!.sets).toHaveLength(5);
    expect(changed.exercises[0]!.sets.map((s) => s.setNumber)).toEqual([1, 2, 3, 4, 5]);
    // New sets clone the last real one's prescription.
    expect(changed.exercises[0]!.sets[4]).toMatchObject({ reps: 8, rpe: 7.5, restSec: 90 });
    expect(changed.estimatedSec).not.toBe(before.blocks.find((b) => b.letter === 'C')!.estimatedSec);

    const shrunk = applyProposal(before, adjustSets({ sets: 2 }), FULL_GYM_CTX);
    expect(shrunk.find((b) => b.letter === 'C')!.exercises[0]!.sets).toHaveLength(2);
  });

  it('a valid adjust_sets on a superset resizes every exercise in lockstep and updates rounds', () => {
    const before = planned();
    const result = applyProposal(before, adjustSets({ blockLetter: 'D', slot: 'D1', sets: 4 }), FULL_GYM_CTX);

    const changed = result.find((b) => b.letter === 'D')!;
    expect(changed.rounds).toBe(4);
    expect(changed.exercises[0]!.sets).toHaveLength(4);
    expect(changed.exercises[1]!.sets).toHaveLength(4); // D2 moved too, even though only D1 was named.
  });

  it('adjust_load changing percentTm clears the now-stale weightKg, but leaves it alone when only rpe changes', () => {
    const before = planned();

    const percentChanged = applyProposal(before, adjustLoad({ percentTm: 0.8 }), FULL_GYM_CTX);
    const changedSet = percentChanged.find((b) => b.letter === 'A')!.exercises[0]!.sets.find((s) => s.setNumber === 2)!;
    expect(changedSet.percentTm).toBe(0.8);
    expect(changedSet.weightKg).toBeUndefined();
    expect(changedSet.rpe).toBe(8.0); // untouched

    const rpeChanged = applyProposal(before, adjustLoad({ rpe: 8.5 }), FULL_GYM_CTX);
    const rpeSet = rpeChanged.find((b) => b.letter === 'A')!.exercises[0]!.sets.find((s) => s.setNumber === 2)!;
    expect(rpeSet.rpe).toBe(8.5);
    expect(rpeSet.weightKg).toBe(100); // untouched
    expect(rpeSet.percentTm).toBe(0.75); // untouched
  });

  it('never mutates the session it was given', () => {
    const before = planned();
    const snapshot = JSON.parse(JSON.stringify(before.blocks));
    applyProposal(before, swap(), FULL_GYM_CTX);
    applyProposal(before, adjustSets({ sets: 6 }), FULL_GYM_CTX);
    applyProposal(before, adjustLoad({ percentTm: 0.8 }), FULL_GYM_CTX);
    expect(before.blocks).toEqual(snapshot);
  });
});
