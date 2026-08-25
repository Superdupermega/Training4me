import type { Exercise } from '../types';
import type { TargetKind } from './types';

/**
 * Which target kinds make sense for a given exercise, first-to-last =
 * default-to-least-likely. An exercise's `metric` already says how it's
 * fundamentally measured — reps, duration, or distance — so the builder
 * shouldn't offer the other family of options at all: a bench press was
 * never going to be logged in metres, and a farmer carry was never going to
 * be logged in reps.
 *
 * A movement that covers ground (a carry, a sled push/drag — `pattern:
 * 'carry'` or `force: 'locomotion'`) can reasonably be programmed either
 * way — "walk it for 30m" or "walk it for 45s" — so both options are
 * offered for those. A static hold (a plank, a dead hang) only ever makes
 * sense timed.
 */
export function targetOptionsFor(exercise: Exercise): TargetKind[] {
  if (exercise.metric === 'reps') return ['rpe', 'percent_tm', 'weight', 'bodyweight'];
  const swappable = exercise.pattern === 'carry' || exercise.force === 'locomotion';
  if (exercise.metric === 'distance') return swappable ? ['distance', 'duration'] : ['distance'];
  return swappable ? ['duration', 'distance'] : ['duration'];
}

/** Rep count (and "per side" reps) only mean something for a reps-target movement. */
export function usesReps(targetKind: TargetKind): boolean {
  return targetKind === 'rpe' || targetKind === 'percent_tm' || targetKind === 'weight' || targetKind === 'bodyweight';
}

/**
 * A distance/duration movement that's also loadable (a farmer carry, a
 * weighted plank) needs its own weight field — `targetKind: 'weight'`
 * already covers a fixed weight for a reps movement, so this only ever
 * fires for the other two, and only when the exercise can actually take
 * external load.
 */
export function showsSeparateWeightField(exercise: Exercise, targetKind: TargetKind): boolean {
  return exercise.loadable && (targetKind === 'distance' || targetKind === 'duration');
}
