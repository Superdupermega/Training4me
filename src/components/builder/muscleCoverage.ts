import { GROUP_MUSCLES, groupsFor, type MuscleGroup } from '@/core/library/muscles';
import { getExercise } from '@/core/library/exercises';
import type { EditableDay } from './editable';

/** Groups with at least one real muscle mapped — 'mobility'/'full_body' are
 * never derivable from `primaryMuscles` and would just show as permanently
 * uncovered noise. */
export const COVERAGE_GROUPS: MuscleGroup[] = (Object.keys(GROUP_MUSCLES) as MuscleGroup[])
  .filter((g) => GROUP_MUSCLES[g].length > 0);

/** Which muscle groups a day's exercises already train, from their primary muscles. */
export function coverageFor(days: EditableDay[]): Set<MuscleGroup> {
  const groups = new Set<MuscleGroup>();
  for (const day of days) {
    for (const block of day.blocks) {
      for (const item of block.items) {
        const exercise = getExercise(item.exerciseId);
        for (const g of groupsFor(exercise.primaryMuscles)) groups.add(g);
      }
    }
  }
  return groups;
}
