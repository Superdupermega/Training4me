import type { Equipment, Exercise, MovementPattern, PainArea } from '../types';

export interface WeekState {
  /** Working sets per pattern this week. */
  sets: Record<string, number>;
  usedCount: Record<string, number>;
  hasUnilateralLower: boolean;
  hasUnilateralUpper: boolean;
  hasCarry: boolean;
  hasPullV: boolean;
  hasPushV: boolean;
}

export function emptyWeekState(): WeekState {
  return {
    sets: {},
    usedCount: {},
    hasUnilateralLower: false,
    hasUnilateralUpper: false,
    hasCarry: false,
    hasPullV: false,
    hasPushV: false,
  };
}

const LOWER: MovementPattern[] = ['squat', 'hinge', 'lunge', 'isolation_lower'];

export function recordUse(state: WeekState, ex: Exercise, workingSets: number): void {
  state.sets[ex.pattern] = (state.sets[ex.pattern] ?? 0) + workingSets;
  state.usedCount[ex.id] = (state.usedCount[ex.id] ?? 0) + 1;
  if (ex.unilateral) {
    if (LOWER.includes(ex.pattern)) state.hasUnilateralLower = true;
    else if (ex.pattern !== 'trunk' && ex.pattern !== 'mobility') state.hasUnilateralUpper = true;
  }
  if (ex.pattern === 'carry') state.hasCarry = true;
  if (ex.pattern === 'pull_v') state.hasPullV = true;
  if (ex.pattern === 'push_v') state.hasPushV = true;
}

export function setsFor(state: WeekState, ...patterns: MovementPattern[]): number {
  return patterns.reduce((sum, p) => sum + (state.sets[p] ?? 0), 0);
}

export function overusedIds(state: WeekState, limit = 2): string[] {
  return Object.entries(state.usedCount)
    .filter(([, n]) => n >= limit)
    .map(([id]) => id);
}

export interface GenContext {
  equipment: Equipment[];
  painFlags: PainArea[];
  allowAdvanced: boolean;
  trainingMaxes: Record<string, number>;
  increment: number;
  sessionCapSec: number;
  paceFactor: number;
  experience: string;
}
