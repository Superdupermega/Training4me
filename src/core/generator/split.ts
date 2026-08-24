import type { MovementPattern, SessionArchetype } from '../types';
import { DomainError } from '../types';

export interface SkeletonDay {
  dayNumber: number;
  weekday: number; // 1 = Monday
  archetype: SessionArchetype;
  mainPattern: MovementPattern | null;
  title: string;
}

type Slot = { archetype: SessionArchetype; mainPattern: MovementPattern | null; title: string };

const SQ: Slot = { archetype: 'FB-A', mainPattern: 'squat', title: 'Squat day' };
const HI: Slot = { archetype: 'FB-C', mainPattern: 'hinge', title: 'Hinge day' };
const PR: Slot = { archetype: 'FB-B', mainPattern: 'push_v', title: 'Press day' };
const LSQ: Slot = { archetype: 'LOWER-SQ', mainPattern: 'squat', title: 'Lower — squat' };
const LHI: Slot = { archetype: 'LOWER-HINGE', mainPattern: 'hinge', title: 'Lower — hinge' };
const UPU: Slot = { archetype: 'UPPER-PUSH', mainPattern: 'push_h', title: 'Upper — push' };
const UPL: Slot = { archetype: 'UPPER-PULL', mainPattern: 'pull_v', title: 'Upper — pull' };
const AER: Slot = { archetype: 'AEROBIC-MOBILITY', mainPattern: null, title: 'Aerobic + mobility' };
const PMP: Slot = { archetype: 'PUMP-BALANCE', mainPattern: null, title: 'Balance + pump' };

const SKELETONS: Record<number, { slots: Slot[]; weekdays: number[] }> = {
  2: { slots: [SQ, HI], weekdays: [1, 4] },
  3: { slots: [SQ, PR, HI], weekdays: [1, 3, 5] },
  4: { slots: [LSQ, UPU, LHI, UPL], weekdays: [1, 2, 4, 5] },
  5: { slots: [LSQ, UPU, AER, LHI, UPL], weekdays: [1, 2, 3, 5, 6] },
  6: { slots: [LSQ, UPU, AER, LHI, UPL, PMP], weekdays: [1, 2, 3, 5, 6, 7] },
};

export function describeSkeleton(daysPerWeek: number): string {
  switch (daysPerWeek) {
    case 2: return 'Two full-body sessions. One squat day, one hinge day, everything covered.';
    case 3: return 'Full body, three times. Squat, press and hinge each get their own heavy day.';
    case 4: return 'Upper/lower split. Two lower days, two upper days, 48 hours between repeats.';
    case 5: return 'Four lifting days plus one easy aerobic and mobility day in the middle.';
    case 6: return 'Four lifting days, one aerobic day, and one light balance and pump day.';
    default: return '';
  }
}

/** Throws when the same heavy pattern lands within 48 hours. */
export function assertPatternSpacing(days: SkeletonDay[]): void {
  const loaded = days.filter((d) => d.mainPattern);
  for (let i = 0; i < loaded.length; i += 1) {
    for (let j = i + 1; j < loaded.length; j += 1) {
      const a = loaded[i]!;
      const b = loaded[j]!;
      if (a.mainPattern !== b.mainPattern) continue;
      const gap = Math.min(Math.abs(b.weekday - a.weekday), 7 - Math.abs(b.weekday - a.weekday));
      if (gap < 2) {
        throw new DomainError('PATTERN_TOO_CLOSE', `${a.mainPattern} trained twice within 48 hours`, {
          pattern: a.mainPattern, weekdays: [a.weekday, b.weekday],
        });
      }
    }
  }
}

export function buildWeekSkeleton(daysPerWeek: number, preferredWeekdays?: number[]): SkeletonDay[] {
  const skeleton = SKELETONS[daysPerWeek];
  if (!skeleton) {
    throw new DomainError('BAD_DAYS_PER_WEEK', `daysPerWeek must be 2-6, got ${daysPerWeek}`, { daysPerWeek });
  }
  const weekdays =
    preferredWeekdays && preferredWeekdays.length === daysPerWeek
      ? [...preferredWeekdays].sort((a, b) => a - b)
      : skeleton.weekdays;

  const days = skeleton.slots.map((slot, i) => ({
    dayNumber: i + 1,
    weekday: weekdays[i]!,
    archetype: slot.archetype,
    mainPattern: slot.mainPattern,
    title: slot.title,
  }));
  assertPatternSpacing(days);
  return days;
}
