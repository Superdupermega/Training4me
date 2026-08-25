import type { Exercise } from '../../types';
import { CHEST } from './chest';
import { BACK } from './back';
import { SHOULDERS } from './shoulders';
import { ARMS } from './arms';
import { CORE } from './core';
import { QUADS } from './quads';
import { HAMSTRINGS_GLUTES } from './hamstrings-glutes';
import { CALVES } from './calves';
import { CARRY_GRIP } from './carry-grip';
import { CARDIO } from './cardio';
import { MOBILITY } from './mobility';
import { FULL_BODY } from './full-body';

/**
 * The library, split one file per muscle group (chunk 16) rather than one
 * ~5000-line file. File placement is purely for maintainability — which
 * muscle groups a movement actually belongs to, for the browse-by-muscle-
 * group screen, comes entirely from its `primaryMuscles` data via
 * `browseGroupsFor` in `../query.ts`, not from which file it lives in.
 */
export const EXERCISES: readonly Exercise[] = [
  ...CHEST, ...BACK, ...SHOULDERS, ...ARMS, ...CORE,
  ...QUADS, ...HAMSTRINGS_GLUTES, ...CALVES,
  ...CARRY_GRIP, ...CARDIO, ...MOBILITY, ...FULL_BODY,
] as const;

export const BY_ID: ReadonlyMap<string, Exercise> = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown exercise id: ${id}`);
  return found;
}
