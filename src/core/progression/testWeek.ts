import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { getExercise } from '../library/exercises';
import { recost } from '../timeBudget';
import type {
  BlockExercise, BlockKind, PlannedSession, PlannedWeek, PrescribedSet, Program, SessionBlock,
} from '../types';
import { epley, resolveTrainingMax, trainingMaxFromOneRepMax } from './trainingMax';
import { roundToIncrement } from './waves';

/**
 * A real test single (or rep-max — the athlete's call in the moment) beats
 * the peak week's inferred verdict. `reps === 1` is treated as exactly what
 * it is: the tested weight, rounded to the nearest increment, no formula
 * involved. `reps > 1` runs through the same Epley estimate every other
 * 1RM-from-a-set path in this file uses, then the same 90% TM ratio
 * `trainingMaxFromOneRepMax` already applies. Deliberately *not*
 * `estimateTrainingMax` — that function's extra 5% haircut exists because
 * onboarding has zero trust in a self-reported number; a mid-block, logged,
 * supervised test earns the plain 90% instead. See docs/DECISIONS.md.
 */
export function trainingMaxFromTestResult(weightKg: number, reps: number): number {
  if (reps <= 1) return roundToIncrement(weightKg, 2.5);
  return trainingMaxFromOneRepMax(epley(weightKg, reps));
}

export interface BuildTestWeekArgs {
  /** The just-finished block — its week-one template decides which days exist and what they trained. */
  program: Program;
  /** Which of that block's T1 lifts to actually test (a subset is fine — see docs/11-COACH-PLATFORM.md §7). */
  testExerciseIds: string[];
  /**
   * Current training maxes, used only to size the ramp toward a sane
   * starting point — not `program.input.trainingMaxes`. Nothing about a
   * training max changes mid-block in this app, so in the ordinary flow
   * they agree; the parameter exists so a test week run from a routine-
   * builder block (whose `input` carries no training maxes at all — see
   * `scheduleRoutine`) still ramps to something real instead of nothing.
   */
  trainingMaxes: Record<string, number>;
  /** ISO yyyy-mm-dd, Monday-anchored — where the test week's own week one starts. */
  startDate: string;
  increment: number;
  paceFactor: number;
}

/** Same 0.4/0.6/0.8-of-target shape `prescriptionFor` already ramps with — not a new one. */
const RAMP_FRACTIONS = [0.4, 0.6, 0.8];

function dateFor(startDate: string, weekday: number): string {
  const monday = startOfWeek(parseISO(startDate), { weekStartsOn: 1 });
  return format(addDays(monday, weekday - 1), 'yyyy-MM-dd');
}

function buildTestMainBlock(exerciseId: string, targetKg: number | undefined, increment: number): SessionBlock {
  const exercise = getExercise(exerciseId);
  const sets: PrescribedSet[] = [];

  if (targetKg) {
    RAMP_FRACTIONS.forEach((fraction, i) => {
      sets.push({
        setNumber: i + 1,
        kind: 'ramp',
        reps: i === 2 ? 3 : 5,
        weightKg: Math.max(increment, roundToIncrement(targetKg * fraction, increment)),
        restSec: 90,
        estimatedSec: 0,
      });
    });
  }

  sets.push({
    setNumber: sets.length + 1,
    kind: 'top',
    reps: 1,
    weightKg: targetKg ? roundToIncrement(targetKg, increment) : undefined,
    rpe: 9,
    restSec: 240,
    estimatedSec: 0,
  });

  return {
    letter: 'B',
    kind: 'main',
    name: 'Test single',
    note: targetKg
      ? 'Ramp up, then work to a real top single at or above this weight — a true rep max is fine '
        + 'too if that reads better today. Add a set if it still moves well. Log exactly what you hit.'
      : 'No training max on file yet — work up by feel to a real top single and log exactly what you hit.',
    exercises: [{
      slot: 'B', exerciseId, tempo: exercise.defaultTempo, cue: exercise.cue, sets,
    }],
    estimatedSec: 0,
  };
}

/**
 * A light double at the day's original secondary movement — enough that the
 * visit isn't just one lift, nowhere near enough to blunt the test itself.
 */
function buildLightAccessory(source: SessionBlock, letter: string): SessionBlock | null {
  const be = source.exercises[0];
  if (!be) return null;
  const exercise = getExercise(be.exerciseId);
  const sets: PrescribedSet[] = Array.from({ length: 2 }, (_, i) => ({
    setNumber: i + 1, kind: 'working', reps: exercise.repLo, perSide: exercise.unilateral,
    rpe: 6, restSec: 60, estimatedSec: 0,
  }));
  const kind: BlockKind = source.kind === 'superset' ? 'secondary' : source.kind;
  return {
    letter, kind, name: exercise.name,
    exercises: [{ slot: letter, exerciseId: be.exerciseId, tempo: exercise.defaultTempo, cue: exercise.cue, sets }],
    estimatedSec: 0,
  };
}

/**
 * Not a second generator mode: one session per day the finished block
 * already trained a tested T1 on, each a primer (copied verbatim from that
 * same day), the test single, and one light accessory — no trimming ladder,
 * no balance repair, because these sessions are short and low-volume by
 * construction. Movements come from the block's own week-one template
 * (`program.plan[0]`), exactly like `rematerializeWeek` treats it as the
 * source of truth for what a block trained.
 */
export function buildTestWeek(args: BuildTestWeekArgs): PlannedWeek {
  const { program, testExerciseIds, trainingMaxes, startDate, increment, paceFactor } = args;
  const templateWeek = program.plan[0];
  if (!templateWeek) return { weekNumber: 1, isDeload: false, sessions: [] };

  const testSet = new Set(testExerciseIds);
  const sessions: PlannedSession[] = [];
  let dayNumber = 1;

  for (const template of templateWeek.sessions) {
    const mainBlock = template.blocks.find((b) => b.kind === 'main');
    const mainExerciseId = mainBlock?.exercises[0]?.exerciseId;
    if (!mainExerciseId || !testSet.has(mainExerciseId)) continue;

    const primer = template.blocks.find((b) => b.kind === 'primer') ?? null;
    const accessorySource = template.blocks.find((b) => b.kind === 'secondary' || b.kind === 'superset') ?? null;
    const exercise = getExercise(mainExerciseId);
    const target = resolveTrainingMax(mainExerciseId, exercise.pattern, trainingMaxes);

    const blocks: SessionBlock[] = [];
    if (primer) blocks.push(primer);
    blocks.push(buildTestMainBlock(mainExerciseId, target, increment));
    const accessory = accessorySource && buildLightAccessory(accessorySource, 'C');
    if (accessory) blocks.push(accessory);

    const session: PlannedSession = {
      weekNumber: 1, dayNumber, weekday: template.weekday, date: dateFor(startDate, template.weekday),
      archetype: 'CUSTOM', title: `Test — ${exercise.name}`, mainPattern: exercise.pattern,
      isDeload: false, blocks, estimatedSec: 0, trimLog: [],
    };
    sessions.push(recost(session, paceFactor));
    dayNumber += 1;
  }

  return { weekNumber: 1, isDeload: false, sessions };
}
