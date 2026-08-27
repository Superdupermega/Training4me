import { describe, expect, it } from 'vitest';
import { estimateSet } from '../timeBudget';
import { secondsPerRep } from '../tempo';
import type { PrescribedSet } from '../types';
import { materializeRoutine } from './materializeRoutine';
import type { Routine, RoutineItem } from './types';

const baseItem: Omit<RoutineItem, 'id' | 'position' | 'blockLetter' | 'exerciseId'> = {
  blockKind: 'secondary',
  supersetGroup: null,
  sets: 3,
  repLo: 8,
  repHi: 10,
  tempo: '30X1',
  restSec: 90,
  targetKind: 'rpe',
  percentTm: null,
  rpe: 8,
  weightKg: null,
  durationSec: null,
  distanceM: null,
  perSide: false,
  notes: null,
};

function item(overrides: Partial<RoutineItem> & Pick<RoutineItem, 'id' | 'position' | 'blockLetter' | 'exerciseId'>): RoutineItem {
  return { ...baseItem, ...overrides };
}

function routine(items: RoutineItem[], overrides: Partial<Routine> = {}): Routine {
  return {
    id: 'r1', name: 'Test Routine', description: null, weeks: 1, daysPerWeek: 1,
    days: [{ id: 'd1', dayIndex: 1, name: 'Day 1', weekday: 1, notes: null, items }],
    ...overrides,
  };
}

const args = { startDate: '2026-08-24', trainingMaxes: {}, increment: 2.5, paceFactor: 1 };

describe('materializeRoutine', () => {
  it('materialises a one-day, three-item routine into one session with three blocks', () => {
    const r = routine([
      item({ id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'back-squat', blockKind: 'main' }),
      item({ id: 'i2', position: 2, blockLetter: 'B', exerciseId: 'db-bench-press' }),
      item({ id: 'i3', position: 3, blockLetter: 'C', exerciseId: 'barbell-row' }),
    ]);
    const plan = materializeRoutine(r, args);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.sessions).toHaveLength(1);
    const session = plan[0]!.sessions[0]!;
    expect(session.blocks).toHaveLength(3);
    expect(session.blocks.map((b) => b.letter)).toEqual(['A', 'B', 'C']);
    expect(session.blocks[0]!.kind).toBe('main');
    expect(session.mainPattern).toBe('squat');
  });

  it('names a single-exercise block after its exercise, so same-kind blocks stay distinguishable', () => {
    // Three secondary blocks in one day used to render as three collapsed
    // accordions all reading "Secondary", with nothing to tell them apart.
    const r = routine([
      item({ id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'bench-press' }),
      item({ id: 'i2', position: 2, blockLetter: 'B', exerciseId: 'barbell-row' }),
      item({ id: 'i3', position: 3, blockLetter: 'C', exerciseId: 'db-curl' }),
    ]);
    const blocks = materializeRoutine(r, args)[0]!.sessions[0]!.blocks;
    expect(blocks.every((b) => b.kind === 'secondary')).toBe(true);
    expect(blocks.map((b) => b.name)).toEqual(['Bench Press', 'Barbell Row', 'DB Curl']);
    expect(new Set(blocks.map((b) => b.name)).size).toBe(3);
  });

  it('groups a shared block letter into one superset block, rounds correct, slots D1/D2', () => {
    const r = routine([
      item({ id: 'i1', position: 1, blockLetter: 'D', exerciseId: 'db-curl', sets: 3, supersetGroup: 'g1' }),
      item({ id: 'i2', position: 2, blockLetter: 'D', exerciseId: 'triceps-pushdown', sets: 4, supersetGroup: 'g1' }),
    ]);
    const plan = materializeRoutine(r, args);
    const block = plan[0]!.sessions[0]!.blocks[0]!;
    expect(block.kind).toBe('superset');
    expect(block.rounds).toBe(4); // max of the two items' set counts
    expect(block.exercises.map((e) => e.slot)).toEqual(['D1', 'D2']);
    // Every exercise in the superset gets `rounds` loggable sets, not its own count.
    expect(block.exercises[0]!.sets).toHaveLength(4);
    expect(block.exercises[1]!.sets).toHaveLength(4);
  });

  it('resolves percent_tm against a known training max, rounded to the increment', () => {
    const r = routine([
      item({
        id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'back-squat', blockKind: 'main',
        targetKind: 'percent_tm', percentTm: 80, rpe: null,
      }),
    ]);
    const plan = materializeRoutine(r, { ...args, trainingMaxes: { 'back-squat': 140 } });
    const set = plan[0]!.sessions[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    expect(set.weightKg).toBe(112.5); // 140 * 0.80 = 112, rounded to nearest 2.5
    expect(set.percentTm).toBe(0.8);
  });

  it('falls back to an RPE target when percent_tm has no training max on file, never 0 kg', () => {
    const r = routine([
      item({
        id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'back-squat', blockKind: 'main',
        targetKind: 'percent_tm', percentTm: 80, rpe: 7.5,
      }),
    ]);
    const plan = materializeRoutine(r, args); // no training maxes at all
    const set = plan[0]!.sessions[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    expect(set.weightKg).toBeUndefined();
    expect(set.weightKg).not.toBe(0);
    expect(set.rpe).toBe(7.5);
  });

  it('estimates seconds within 5% of the same sets costed by the generator\'s own model', () => {
    const r = routine([
      item({ id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'db-bench-press', blockKind: 'main', sets: 4, repLo: 8, tempo: '30X1', restSec: 120 }),
    ]);
    const plan = materializeRoutine(r, args);
    const set = plan[0]!.sessions[0]!.blocks[0]!.exercises[0]!.sets[0]!;

    const independentSet: PrescribedSet = { setNumber: 1, kind: 'working', reps: 8, restSec: 120, estimatedSec: 0 };
    const expected = estimateSet(independentSet, '30X1');
    expect(set.estimatedSec).toBeGreaterThan(0);
    expect(Math.abs(set.estimatedSec - expected) / expected).toBeLessThanOrEqual(0.05);
    // Sanity: the tempo cost model is actually being used, not a stub.
    expect(secondsPerRep('30X1')).toBeGreaterThan(0);
  });

  it('never trims — the athlete\'s plan is the athlete\'s plan, however long it runs', () => {
    const items: RoutineItem[] = Array.from({ length: 8 }, (_, i) =>
      item({
        id: `i${i}`, position: i, blockLetter: String.fromCharCode(65 + i),
        exerciseId: 'db-bench-press', sets: 5, restSec: 180,
      }));
    const r = routine(items);
    const plan = materializeRoutine(r, args);
    expect(plan[0]!.sessions[0]!.blocks).toHaveLength(8);
    expect(plan[0]!.sessions[0]!.trimLog).toEqual([]);
  });

  it('repeats week-identical prescriptions across multiple weeks', () => {
    const r = routine(
      [item({ id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'back-squat', blockKind: 'main' })],
      { weeks: 3 },
    );
    const plan = materializeRoutine(r, args);
    expect(plan).toHaveLength(3);
    const week1Set = plan[0]!.sessions[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    const week3Set = plan[2]!.sessions[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    expect(week3Set.reps).toBe(week1Set.reps);
    expect(week3Set.rpe).toBe(week1Set.rpe);
  });

  it('carries the "added weight" field through for a loaded carry, alongside its distance and per-side flag', () => {
    const r = routine([
      item({
        id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'farmer-carry',
        targetKind: 'distance', distanceM: 30, weightKg: 24, perSide: false, rpe: null,
      }),
    ]);
    const plan = materializeRoutine(r, args);
    const set = plan[0]!.sessions[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    expect(set.distanceM).toBe(30);
    expect(set.weightKg).toBe(24);
    expect(set.reps).toBeUndefined();
  });

  it('carries weight and per-side through for a duration target too — a suitcase carry timed, not paced', () => {
    const r = routine([
      item({
        id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'suitcase-carry',
        targetKind: 'duration', durationSec: 40, weightKg: 20, perSide: true, rpe: null,
      }),
    ]);
    const plan = materializeRoutine(r, args);
    const set = plan[0]!.sessions[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    expect(set.durationSec).toBe(40);
    expect(set.weightKg).toBe(20);
    expect(set.perSide).toBe(true);
  });

  it('advances the date by a week for each successive week', () => {
    const r = routine(
      [item({ id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'back-squat', blockKind: 'main' })],
      { weeks: 2 },
    );
    const plan = materializeRoutine(r, args);
    const d1 = new Date(plan[0]!.sessions[0]!.date);
    const d2 = new Date(plan[1]!.sessions[0]!.date);
    expect((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)).toBe(7);
  });
});
