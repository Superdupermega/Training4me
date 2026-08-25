import type { Routine, RoutineDay, RoutineItem, TargetKind } from '@/core/builder/types';
import type { BlockKind } from '@/core/types';

/**
 * Client-side editing shape. The domain model (`RoutineItem`) groups items by
 * `blockLetter`/`position`, which is exactly right for storage and for the
 * materialiser, but awkward to edit directly — reordering a block means
 * relettering everything after it. The editor instead works on an ordered
 * list of blocks (each holding 1+ items — 2+ means a superset), and
 * `blockLetter`/`position` are derived fresh from display order only at
 * save time, in `toRoutineDays`.
 */
export interface EditableItem {
  clientId: string;
  exerciseId: string;
  blockKind: BlockKind;
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
}

export interface EditableBlock {
  clientId: string;
  items: EditableItem[];
}

export interface EditableDay {
  id: string;
  dayIndex: number;
  name: string;
  weekday: number | null;
  blocks: EditableBlock[];
}

let counter = 0;
export function newClientId(): string {
  counter += 1;
  return `c${Date.now()}_${counter}`;
}

export function newDay(name: string): EditableDay {
  return { id: newClientId(), dayIndex: 0, name, weekday: null, blocks: [] };
}

/**
 * Reassigns `dayIndex`/`weekday` to match array order (1-based, sequential —
 * the same convention `createRoutine` seeds new routines with). Called after
 * any add/remove/reorder so a day's position in the list is always the
 * single source of truth for both fields; nothing in the editor lets an
 * athlete pick a day's weekday independently of where it sits in the week.
 */
export function renumberDays(days: EditableDay[]): EditableDay[] {
  return days.map((d, i) => ({ ...d, dayIndex: i + 1, weekday: i + 1 }));
}

export function newItem(exerciseId: string): EditableItem {
  return {
    clientId: newClientId(), exerciseId, blockKind: 'secondary', sets: 3,
    repLo: 8, repHi: 12, tempo: '30X1', restSec: 90, targetKind: 'rpe',
    percentTm: null, rpe: 8, weightKg: null, durationSec: null, distanceM: null, perSide: false,
  };
}

export function fromRoutine(routine: Routine): EditableDay[] {
  return routine.days
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((day) => fromRoutineDay(day));
}

function fromRoutineDay(day: RoutineDay): EditableDay {
  const byLetter = new Map<string, RoutineItem[]>();
  for (const item of day.items) {
    const list = byLetter.get(item.blockLetter) ?? [];
    list.push(item);
    byLetter.set(item.blockLetter, list);
  }
  const blocks: EditableBlock[] = [...byLetter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, items]) => ({
      clientId: newClientId(),
      items: items
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((i) => ({
          clientId: newClientId(), exerciseId: i.exerciseId, blockKind: i.blockKind, sets: i.sets,
          repLo: i.repLo, repHi: i.repHi, tempo: i.tempo, restSec: i.restSec, targetKind: i.targetKind,
          percentTm: i.percentTm, rpe: i.rpe, weightKg: i.weightKg, durationSec: i.durationSec,
          distanceM: i.distanceM, perSide: i.perSide,
        })),
    }));
  return { id: day.id, dayIndex: day.dayIndex, name: day.name, weekday: day.weekday, blocks };
}

const letterFor = (index: number): string => String.fromCharCode(65 + index);

export function toRoutineDays(days: EditableDay[]): RoutineDay[] {
  return days.map((day) => {
    let position = 0;
    const items: RoutineItem[] = day.blocks.flatMap((block, blockIndex) => {
      const letter = letterFor(blockIndex);
      const isSuperset = block.items.length > 1;
      return block.items.map((item) => {
        position += 1;
        return {
          id: '', position, blockLetter: letter, blockKind: item.blockKind,
          supersetGroup: isSuperset ? block.clientId : null,
          exerciseId: item.exerciseId, sets: item.sets, repLo: item.repLo, repHi: item.repHi,
          tempo: item.tempo, restSec: item.restSec, targetKind: item.targetKind,
          percentTm: item.percentTm, rpe: item.rpe, weightKg: item.weightKg,
          durationSec: item.durationSec, distanceM: item.distanceM, perSide: item.perSide, notes: null,
        };
      });
    });
    return { id: day.id, dayIndex: day.dayIndex, name: day.name, weekday: day.weekday, notes: null, items };
  });
}
