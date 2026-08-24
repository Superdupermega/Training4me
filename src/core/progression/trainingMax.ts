import type { Experience, MovementPattern } from '../types';
import { roundToIncrement } from './waves';

export const ANCHOR: Record<string, string> = {
  squat: 'back-squat',
  hinge: 'deadlift',
  push_h: 'bench-press',
  push_v: 'overhead-press',
  pull_h: 'barbell-row',
};

/** Training-max ratios relative to the pattern's anchor lift. */
const RATIO: Record<string, number> = {
  'back-squat': 1, 'front-squat': 0.85, 'box-squat': 0.95,
  deadlift: 1, 'trap-bar-deadlift': 1.05, 'romanian-deadlift': 0.7,
  'bench-press': 1, 'close-grip-bench-press': 0.9, 'floor-press': 0.9,
  'overhead-press': 1, 'push-press': 1.15,
  'barbell-row': 1, 'pendlay-row': 0.95,
};

export function epley(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/** First-block training max: 90% of estimated 1RM, then a 5% safety haircut. */
export function estimateTrainingMax(weightKg: number, reps: number): number {
  return roundToIncrement(epley(weightKg, reps) * 0.9 * 0.95, 2.5);
}

export function trainingMaxFromOneRepMax(oneRepMaxKg: number): number {
  return roundToIncrement(oneRepMaxKg * 0.9, 2.5);
}

/**
 * Resolve a training max for any T1 lift from the four anchors the athlete
 * actually entered. Returns undefined when we genuinely don't know, in which
 * case the prescription falls back to RPE.
 */
export function resolveTrainingMax(
  exerciseId: string,
  pattern: MovementPattern,
  trainingMaxes: Record<string, number>,
): number | undefined {
  const direct = trainingMaxes[exerciseId];
  if (direct) return direct;
  const anchorId = ANCHOR[pattern];
  if (!anchorId) return undefined;
  const anchor = trainingMaxes[anchorId];
  if (!anchor) return undefined;
  const ratio = RATIO[exerciseId] ?? 0.85;
  return roundToIncrement(anchor * ratio, 2.5);
}

const BODYWEIGHT_1RM: Record<Experience, Record<string, number>> = {
  beginner: { 'back-squat': 0.75, deadlift: 0.95, 'bench-press': 0.55, 'overhead-press': 0.35, 'barbell-row': 0.5 },
  intermediate: { 'back-squat': 1.1, deadlift: 1.35, 'bench-press': 0.8, 'overhead-press': 0.5, 'barbell-row': 0.7 },
  advanced: { 'back-squat': 1.45, deadlift: 1.75, 'bench-press': 1.05, 'overhead-press': 0.65, 'barbell-row': 0.9 },
};

/** Deliberately cautious. Week one runs at 70% of these, so a miss is cheap. */
export function defaultTrainingMaxes(
  bodyweightKg: number,
  experience: Experience,
): Record<string, number> {
  const table = BODYWEIGHT_1RM[experience];
  return Object.fromEntries(
    Object.entries(table).map(([id, mult]) => [id, roundToIncrement(bodyweightKg * mult * 0.9, 2.5)]),
  );
}

export interface TopSetResult {
  allRepsCompleted: boolean;
  rpe: number | null;
}

export interface TrainingMaxVerdict {
  next: number;
  changeKg: number;
  verdict: 'increase' | 'small_increase' | 'hold' | 'reduce';
  forceSixWeekWave: boolean;
  reason: string;
}

export function nextTrainingMax(
  current: number,
  exerciseId: string,
  result: TopSetResult,
  consecutiveHolds = 0,
): TrainingMaxVerdict {
  const isUpper = ['bench-press', 'overhead-press', 'barbell-row', 'push-press', 'close-grip-bench-press', 'floor-press', 'pendlay-row'].includes(exerciseId);

  if (!result.allRepsCompleted) {
    const next = roundToIncrement(current * 0.95, 2.5);
    return { next, changeKg: next - current, verdict: 'reduce', forceSixWeekWave: false, reason: 'Missed reps on the top set — backing off 5%.' };
  }
  const rpe = result.rpe ?? 8.5;
  if (rpe <= 8.0) {
    const step = isUpper ? 2.5 : 5;
    return { next: current + step, changeKg: step, verdict: 'increase', forceSixWeekWave: false, reason: 'Top set moved well — full jump.' };
  }
  if (rpe <= 9.0) {
    const step = isUpper ? 1.25 : 2.5;
    return { next: current + step, changeKg: step, verdict: 'small_increase', forceSixWeekWave: false, reason: 'Top set was hard — small jump.' };
  }
  const holds = consecutiveHolds + 1;
  if (holds >= 2) {
    const next = roundToIncrement(current * 0.95, 2.5);
    return { next, changeKg: next - current, verdict: 'reduce', forceSixWeekWave: true, reason: 'Two blocks stalled — resetting 5% and running a longer wave.' };
  }
  return { next: current, changeKg: 0, verdict: 'hold', forceSixWeekWave: false, reason: 'Top set was near maximal — holding the training max.' };
}
