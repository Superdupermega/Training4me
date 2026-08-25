import { describe, expect, it } from 'vitest';
import type { Routine } from '@/core/builder/types';
import { fromRoutine, newItem, toRoutineDays } from './editable';

function baseRoutine(): Routine {
  return {
    id: 'r1', name: 'Test', description: null, weeks: 4, daysPerWeek: 1,
    days: [{
      id: 'd1', dayIndex: 1, name: 'Day 1', weekday: 1, notes: null,
      items: [
        {
          id: 'i1', position: 1, blockLetter: 'A', blockKind: 'main', supersetGroup: null,
          exerciseId: 'back-squat', sets: 5, repLo: 5, repHi: 5, tempo: '20X1', restSec: 180,
          targetKind: 'percent_tm', percentTm: 80, rpe: null, weightKg: null,
          durationSec: null, distanceM: null, perSide: false, notes: null,
        },
        {
          id: 'i2', position: 2, blockLetter: 'D', blockKind: 'secondary', supersetGroup: 'g1',
          exerciseId: 'db-curl', sets: 3, repLo: 10, repHi: 12, tempo: '30X1', restSec: 60,
          targetKind: 'rpe', percentTm: null, rpe: 8, weightKg: null,
          durationSec: null, distanceM: null, perSide: false, notes: null,
        },
        {
          id: 'i3', position: 3, blockLetter: 'D', blockKind: 'secondary', supersetGroup: 'g1',
          exerciseId: 'triceps-pushdown', sets: 3, repLo: 10, repHi: 12, tempo: '30X1', restSec: 60,
          targetKind: 'rpe', percentTm: null, rpe: 8, weightKg: null,
          durationSec: null, distanceM: null, perSide: false, notes: null,
        },
      ],
    }],
  };
}

describe('editable round-trip', () => {
  it('fromRoutine groups by block letter into blocks, preserving position order', () => {
    const days = fromRoutine(baseRoutine());
    expect(days).toHaveLength(1);
    expect(days[0]!.blocks).toHaveLength(2); // A (standalone) and D (superset)
    expect(days[0]!.blocks[0]!.items).toHaveLength(1);
    expect(days[0]!.blocks[1]!.items).toHaveLength(2);
    expect(days[0]!.blocks[1]!.items.map((i) => i.exerciseId)).toEqual(['db-curl', 'triceps-pushdown']);
  });

  it('toRoutineDays relabels blocks A, B, C… by display order, not the original letters', () => {
    const days = fromRoutine(baseRoutine());
    // Reverse the block order — the superset should now come first, as "A".
    const reordered = [{ ...days[0]!, blocks: [days[0]!.blocks[1]!, days[0]!.blocks[0]!] }];
    const routineDays = toRoutineDays(reordered);
    const items = routineDays[0]!.items;
    const supersetItems = items.filter((i) => i.exerciseId === 'db-curl' || i.exerciseId === 'triceps-pushdown');
    const standaloneItem = items.find((i) => i.exerciseId === 'back-squat')!;
    expect(supersetItems.every((i) => i.blockLetter === 'A')).toBe(true);
    expect(standaloneItem.blockLetter).toBe('B');
  });

  it('a round trip (fromRoutine → toRoutineDays) preserves every field a set needs', () => {
    const original = baseRoutine();
    const days = fromRoutine(original);
    const routineDays = toRoutineDays(days);
    const squat = routineDays[0]!.items.find((i) => i.exerciseId === 'back-squat')!;
    expect(squat.sets).toBe(5);
    expect(squat.targetKind).toBe('percent_tm');
    expect(squat.percentTm).toBe(80);
    expect(squat.tempo).toBe('20X1');
    expect(squat.restSec).toBe(180);
  });

  it('marks a superset only when a block actually has 2+ items', () => {
    const days = fromRoutine(baseRoutine());
    const routineDays = toRoutineDays(days);
    const squat = routineDays[0]!.items.find((i) => i.exerciseId === 'back-squat')!;
    const curl = routineDays[0]!.items.find((i) => i.exerciseId === 'db-curl')!;
    expect(squat.supersetGroup).toBeNull();
    expect(curl.supersetGroup).not.toBeNull();
  });

  it('newItem produces a sane, complete default item', () => {
    const item = newItem('bench-press');
    expect(item.exerciseId).toBe('bench-press');
    expect(item.sets).toBeGreaterThan(0);
    expect(item.tempo).toHaveLength(4);
    expect(item.clientId).toBeTruthy();
  });
});
