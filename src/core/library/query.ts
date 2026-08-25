import type { Complexity, Equipment, Exercise, MovementPattern, PainArea, Tier } from '../types';
import { NoSubstituteError } from '../types';
import { EXERCISES, getExercise } from './exercises';
import { groupsFor, type MuscleGroup } from './muscles';

const COMPLEXITY_RANK: Record<Complexity, number> = { simple: 0, moderate: 1, advanced: 2 };

export interface LibraryContext {
  equipment: Equipment[];
  painFlags: PainArea[];
  allowAdvanced: boolean;
}

export function isAvailable(ex: Exercise, equipment: Equipment[]): boolean {
  return ex.equipment.every((item) => equipment.includes(item));
}

function isPermitted(ex: Exercise, ctx: LibraryContext): boolean {
  // Library-only movements (chunk 16) are visible in the browser and the
  // program builder but never reachable by the generator or its substitution
  // ladder — this is the one gate both paths share, so there is nowhere for
  // it to leak through.
  if (ex.inGeneratorPool === false) return false;
  if (!isAvailable(ex, ctx.equipment)) return false;
  if (!ctx.allowAdvanced && COMPLEXITY_RANK[ex.complexity] > COMPLEXITY_RANK.moderate) return false;
  if (ex.contraindications.some((area) => ctx.painFlags.includes(area))) return false;
  return true;
}

export interface FindOptions {
  pattern?: MovementPattern | MovementPattern[];
  tier?: Tier | Tier[];
  unilateral?: boolean;
  exclude?: string[];
  loadable?: boolean;
}

/** Deterministic: results are always sorted by id so a seeded pick is reproducible. */
export function find(ctx: LibraryContext, opts: FindOptions = {}): Exercise[] {
  const patterns = opts.pattern
    ? Array.isArray(opts.pattern) ? opts.pattern : [opts.pattern]
    : null;
  const tiers = opts.tier ? (Array.isArray(opts.tier) ? opts.tier : [opts.tier]) : null;

  return EXERCISES.filter((ex) => {
    if (patterns && !patterns.includes(ex.pattern)) return false;
    if (tiers && !tiers.includes(ex.tier)) return false;
    if (opts.unilateral != null && ex.unilateral !== opts.unilateral) return false;
    if (opts.loadable != null && ex.loadable !== opts.loadable) return false;
    if (opts.exclude?.includes(ex.id)) return false;
    return isPermitted(ex, ctx);
  }).sort((a, b) => a.id.localeCompare(b.id));
}

const LOADING_KIT: Equipment[] = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'trap_bar'];

/**
 * Narrow a candidate list to the options actually worth programming: drop
 * regressions when a standard movement exists, and prefer loadable movements
 * when the athlete has something to load. A bodyweight split squat is the right
 * answer in a hotel room and the wrong one in a full gym.
 */
export function preferred(candidates: Exercise[], equipment: Equipment[]): Exercise[] {
  const standard = candidates.filter((c) => !c.regression);
  const pool = standard.length > 0 ? standard : candidates;
  if (!equipment.some((item) => LOADING_KIT.includes(item))) return pool;
  const loadable = pool.filter((c) => c.loadable);
  return loadable.length > 0 ? loadable : pool;
}

/** Pick deterministically from a candidate list using the seeded rng. */
export function pick<T>(candidates: T[], rng: () => number): T | null {
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)] ?? candidates[0]!;
}

/**
 * The substitution ladder: same pattern + tier, then one tier down, then the
 * movement's own alternatives, then a bodyweight fallback, then give up loudly.
 */
export function substitute(
  original: Exercise | string,
  ctx: LibraryContext,
  exclude: string[] = [],
): Exercise {
  const ex = typeof original === 'string' ? getExercise(original) : original;
  const skip = [...exclude, ex.id];

  const sameTier = find(ctx, { pattern: ex.pattern, tier: ex.tier, exclude: skip });
  if (sameTier[0]) return sameTier[0];

  const lowerTier: Tier[] = ex.tier === 'T1' ? ['T2'] : ex.tier === 'T2' ? ['T3'] : ['T2', 'T3'];
  const downTier = find(ctx, { pattern: ex.pattern, tier: lowerTier, exclude: skip });
  if (downTier[0]) return downTier[0];

  for (const altId of ex.alternatives) {
    if (skip.includes(altId)) continue;
    const alt = getExercise(altId);
    if (isPermitted(alt, ctx)) return alt;
  }

  const bodyweight = find(ctx, { pattern: ex.pattern, exclude: skip }).find((c) =>
    c.equipment.every((item) => item === 'none'),
  );
  if (bodyweight) return bodyweight;

  const anyPattern = find(ctx, { pattern: ex.pattern, exclude: skip });
  if (anyPattern[0]) return anyPattern[0];

  throw new NoSubstituteError({ exerciseId: ex.id, pattern: ex.pattern, tier: ex.tier });
}

export function patternHasAny(ctx: LibraryContext, pattern: MovementPattern): boolean {
  return find(ctx, { pattern }).length > 0;
}

/**
 * Which browse-by-muscle-group buckets an exercise belongs in. `groupsFor`
 * in `./muscles` only derives from `primaryMuscles`, which cannot place a
 * mobility drill or a full-body movement — those aren't muscle-led
 * categories. This adds the two pattern-driven exceptions on top; kept here
 * rather than in `muscles.ts` so that file stays a pure taxonomy definition
 * with no dependency on the exercise domain.
 */
export function browseGroupsFor(ex: Exercise): MuscleGroup[] {
  const fromMuscles = groupsFor(ex.primaryMuscles);
  const extra: MuscleGroup[] = [];
  if (ex.pattern === 'mobility') extra.push('mobility');
  if (ex.pattern === 'aerobic') extra.push('cardio');
  if (ex.isFullBody) extra.push('full_body');
  return [...new Set([...fromMuscles, ...extra])];
}
