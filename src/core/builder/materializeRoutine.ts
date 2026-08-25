import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { getExercise } from '../library/exercises';
import { resolveTrainingMax } from '../progression/trainingMax';
import { roundToIncrement } from '../progression/waves';
import { recost } from '../timeBudget';
import type {
  BlockExercise, MovementPattern, PlannedSession, PlannedWeek, PrescribedSet, SessionBlock,
} from '../types';
import type { Routine, RoutineDay, RoutineItem } from './types';

/** Matches the generator's own block-naming convention (assembleSession.ts). */
const BLOCK_KIND_LABEL: Record<string, string> = {
  primer: 'Primer', main: 'Main lift', secondary: 'Secondary',
  finisher: 'Finisher', downregulate: 'Down-regulate',
};

export interface MaterializeArgs {
  startDate: string;
  /** Overrides `routine.weeks` when the athlete schedules a different length. */
  weeks?: number;
  trainingMaxes: Record<string, number>;
  increment: number;
  paceFactor: number;
}

function dateFor(startDate: string, weekNumber: number, weekday: number): string {
  const monday = startOfWeek(parseISO(startDate), { weekStartsOn: 1 });
  return format(addDays(monday, (weekNumber - 1) * 7 + (weekday - 1)), 'yyyy-MM-dd');
}

/**
 * A single set for one item. No ramp sets — those are a generator nicety for
 * the wave-based prescription; a self-built routine's sets are exactly what
 * the athlete configured, every week (week-identical repetition — see
 * DECISIONS.md 2026-08-25 on why a progression scheme was left for later).
 */
function materializeSet(item: RoutineItem, setNumber: number): PrescribedSet {
  const base: PrescribedSet = { setNumber, kind: 'working', restSec: item.restSec, estimatedSec: 0 };

  switch (item.targetKind) {
    case 'duration':
      return { ...base, durationSec: item.durationSec ?? undefined };
    case 'distance':
      return { ...base, distanceM: item.distanceM ?? undefined };
    case 'bodyweight':
      // weightKg here is *added* load on top of bodyweight (a vest, a belt)
      // — optional, so undefined/0 both mean "bodyweight only".
      return { ...base, reps: item.repLo ?? item.repHi ?? 8, perSide: item.perSide, weightKg: item.weightKg ?? undefined };
    case 'weight':
      return { ...base, reps: item.repLo ?? item.repHi ?? 8, perSide: item.perSide, weightKg: item.weightKg ?? undefined };
    case 'rpe':
      return { ...base, reps: item.repLo ?? item.repHi ?? 8, perSide: item.perSide, rpe: item.rpe ?? undefined };
    // 'percent_tm' is never reached here — materializeItemSets routes it to
    // resolvePercentTmSet below, which has the training maxes in scope this
    // function doesn't. The default branch below only exists to satisfy the
    // switch's fallthrough safely if that routing is ever changed.
    default:
      return { ...base, reps: item.repLo ?? item.repHi ?? 8, perSide: item.perSide };
  }
}

/** percent_tm resolves through the same training-max logic the generator uses. */
function resolvePercentTmSet(
  item: RoutineItem, setNumber: number, trainingMaxes: Record<string, number>, increment: number,
): PrescribedSet {
  const exercise = getExercise(item.exerciseId);
  const tm = resolveTrainingMax(item.exerciseId, exercise.pattern, trainingMaxes);
  const base: PrescribedSet = {
    setNumber, kind: 'working', restSec: item.restSec, estimatedSec: 0,
    reps: item.repLo ?? item.repHi ?? 8, perSide: item.perSide,
  };
  if (tm && item.percentTm) {
    return {
      ...base,
      weightKg: roundToIncrement(tm * (item.percentTm / 100), increment),
      percentTm: item.percentTm / 100,
    };
  }
  // No training max on file — fall back to RPE, honestly, rather than
  // fabricating a weight. Mirrors prescriptionFor's own fallback in
  // src/core/progression/waves.ts.
  return { ...base, rpe: item.rpe ?? undefined };
}

function materializeItemSets(
  item: RoutineItem, trainingMaxes: Record<string, number>, increment: number,
): PrescribedSet[] {
  return Array.from({ length: item.sets }, (_, i) =>
    item.targetKind === 'percent_tm'
      ? resolvePercentTmSet(item, i + 1, trainingMaxes, increment)
      : materializeSet(item, i + 1));
}

function materializeExercise(item: RoutineItem, slot: string, trainingMaxes: Record<string, number>, increment: number): BlockExercise {
  const exercise = getExercise(item.exerciseId);
  return {
    slot,
    exerciseId: item.exerciseId,
    tempo: item.tempo,
    cue: exercise.cue,
    sets: materializeItemSets(item, trainingMaxes, increment),
  };
}

/** Groups by `blockLetter`; a group sharing a `supersetGroup` becomes one superset block. */
function materializeDay(day: RoutineDay, trainingMaxes: Record<string, number>, increment: number): SessionBlock[] {
  const byLetter = new Map<string, RoutineItem[]>();
  for (const item of day.items) {
    const list = byLetter.get(item.blockLetter) ?? [];
    list.push(item);
    byLetter.set(item.blockLetter, list);
  }

  return [...byLetter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, itemsUnsorted]) => {
      const items = [...itemsUnsorted].sort((a, b) => a.position - b.position);
      const isSuperset = items.length > 1;

      if (isSuperset) {
        const rounds = Math.max(...items.map((i) => i.sets));
        const exercises = items.map((item, i) =>
          materializeExercise({ ...item, sets: rounds }, `${letter}${i + 1}`, trainingMaxes, increment));
        return {
          letter, kind: 'superset' as const, name: `Superset ${letter}`, rounds,
          exercises, estimatedSec: 0,
        };
      }

      const item = items[0]!;
      return {
        letter, kind: item.blockKind, name: BLOCK_KIND_LABEL[item.blockKind] ?? item.blockKind,
        exercises: [materializeExercise(item, letter, trainingMaxes, increment)],
        estimatedSec: 0,
      };
    });
}

function mainPatternOf(blocks: SessionBlock[]): MovementPattern | null {
  const main = blocks.find((b) => b.kind === 'main');
  const exerciseId = main?.exercises[0]?.exerciseId;
  return exerciseId ? getExercise(exerciseId).pattern : null;
}

/**
 * The builder's counterpart to `generateProgram` — a second producer of the
 * same `SessionBlock[]` shape, not a second player (docs/06-REDESIGN-PLAN.md
 * §3). No balance repair, no trimming: the athlete's plan is the athlete's
 * plan. `recost` (the generator's own cost model) fills in every
 * `estimatedSec` so the two producers' time estimates agree by construction.
 */
export function materializeRoutine(routine: Routine, args: MaterializeArgs): PlannedWeek[] {
  const weeks = args.weeks ?? routine.weeks;
  const days = [...routine.days].sort((a, b) => a.dayIndex - b.dayIndex);

  const weekPlan: PlannedWeek[] = [];
  for (let weekNumber = 1; weekNumber <= weeks; weekNumber += 1) {
    const sessions: PlannedSession[] = days.map((day, i) => {
      const weekday = day.weekday ?? i + 1;
      const blocks = materializeDay(day, args.trainingMaxes, args.increment);
      const session: PlannedSession = {
        weekNumber, dayNumber: i + 1, weekday,
        date: dateFor(args.startDate, weekNumber, weekday),
        archetype: 'CUSTOM', title: day.name,
        mainPattern: mainPatternOf(blocks),
        isDeload: false,
        blocks, estimatedSec: 0, trimLog: [],
      };
      return recost(session, args.paceFactor);
    });
    weekPlan.push({ weekNumber, isDeload: false, sessions });
  }
  return weekPlan;
}
