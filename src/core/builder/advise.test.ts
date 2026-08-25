import { describe, expect, it } from 'vitest';
import { adviseOnWeek } from './advise';
import { materializeRoutine } from './materializeRoutine';
import type { Routine, RoutineItem } from './types';

const baseItem: Omit<RoutineItem, 'id' | 'position' | 'blockLetter' | 'exerciseId'> = {
  blockKind: 'secondary', supersetGroup: null, sets: 4, repLo: 8, repHi: 10,
  tempo: '30X1', restSec: 90, targetKind: 'rpe', percentTm: null, rpe: 8,
  weightKg: null, durationSec: null, distanceM: null, perSide: false, notes: null,
};

const args = { startDate: '2026-08-24', trainingMaxes: {}, increment: 2.5, paceFactor: 1 };

describe('adviseOnWeek', () => {
  it('flags an all-push week as advisory, without throwing or repairing', () => {
    const routine: Routine = {
      id: 'r1', name: 'Push Only', description: null, weeks: 1, daysPerWeek: 1,
      days: [{
        id: 'd1', dayIndex: 1, name: 'Push Day', weekday: 1, notes: null,
        items: [
          { ...baseItem, id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'bench-press', blockKind: 'main' },
          { ...baseItem, id: 'i2', position: 2, blockLetter: 'B', exerciseId: 'overhead-press' },
          { ...baseItem, id: 'i3', position: 3, blockLetter: 'C', exerciseId: 'triceps-pushdown' },
        ],
      }],
    };
    const plan = materializeRoutine(routine, args);
    const violations = adviseOnWeek(plan[0]!, 1);
    // Never throws, always returns a plain array of advisories — the caller
    // decides what (if anything) to show, and can always ignore it.
    expect(Array.isArray(violations)).toBe(true);
    expect(violations.some((v) => v.code === 'B1')).toBe(true); // pull:push ratio
  });

  it('never repairs — the plan it returns is untouched', () => {
    const routine: Routine = {
      id: 'r1', name: 'One Day', description: null, weeks: 1, daysPerWeek: 1,
      days: [{
        id: 'd1', dayIndex: 1, name: 'Day', weekday: 1, notes: null,
        items: [{ ...baseItem, id: 'i1', position: 1, blockLetter: 'A', exerciseId: 'bench-press', blockKind: 'main' }],
      }],
    };
    const plan = materializeRoutine(routine, args);
    const before = JSON.stringify(plan);
    adviseOnWeek(plan[0]!, 1);
    expect(JSON.stringify(plan)).toBe(before);
  });
});
