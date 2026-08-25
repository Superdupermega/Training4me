import type { Exercise, Tier } from '../../types';

/**
 * Every exercise file in this directory builds its entries with `mk()`.
 * `primaryMuscles` has no default — every entry must say what it actually
 * works, on purpose; everything else that's usually the same for a whole
 * file (mechanic, force, tier-based reps/tempo) has a sensible default that
 * can be overridden per entry.
 */
export type Spec = Partial<Exercise> &
  Pick<Exercise, 'id' | 'name' | 'nameSv' | 'pattern' | 'tier' | 'equipment' | 'cue' | 'primaryMuscles'>;

export const REPS: Record<Tier, [number, number]> = { T1: [3, 6], T2: [6, 10], T3: [10, 15], T4: [8, 20] };
export const TEMPO: Record<Tier, string> = { T1: '20X1', T2: '30X1', T3: '20X1', T4: '20X1' };

export const mk = (s: Spec): Exercise => ({
  complexity: 'simple',
  unilateral: false,
  metric: 'reps',
  loadingSecondsPerRep: 0,
  defaultTempo: TEMPO[s.tier],
  repLo: REPS[s.tier][0],
  repHi: REPS[s.tier][1],
  alternatives: [],
  contraindications: [],
  loadable: true,
  secondaryMuscles: [],
  mechanic: 'compound',
  force: 'push',
  styles: [],
  ...s,
});
