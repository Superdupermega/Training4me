// Domain vocabulary. Single source of truth for every enum in the app.

export const PATTERNS = [
  'squat', 'hinge', 'lunge', 'push_h', 'push_v', 'pull_h', 'pull_v',
  'carry', 'trunk', 'aerobic', 'mobility', 'isolation_upper', 'isolation_lower',
] as const;
export type MovementPattern = (typeof PATTERNS)[number];

export const TIERS = ['T1', 'T2', 'T3', 'T4'] as const;
export type Tier = (typeof TIERS)[number];

export const COMPLEXITIES = ['simple', 'moderate', 'advanced'] as const;
export type Complexity = (typeof COMPLEXITIES)[number];

export const EQUIPMENT = [
  'barbell', 'rack', 'bench', 'dumbbell', 'kettlebell', 'pullup_bar', 'dip_station',
  'bands', 'cardio_machine', 'sled', 'box', 'trap_bar', 'cable', 'none',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_PROFILES = [
  'full_gym', 'home_barbell', 'dumbbells_only', 'kettlebell_only', 'minimal_bodyweight',
] as const;
export type EquipmentProfile = (typeof EQUIPMENT_PROFILES)[number];

export const EXPERIENCES = ['beginner', 'intermediate', 'advanced'] as const;
export type Experience = (typeof EXPERIENCES)[number];

export const PAIN_AREAS = ['knee', 'shoulder', 'lower_back', 'elbow', 'hip', 'wrist'] as const;
export type PainArea = (typeof PAIN_AREAS)[number];

export const ARCHETYPES = [
  'FB-A', 'FB-B', 'FB-C', 'LOWER-SQ', 'UPPER-PUSH', 'LOWER-HINGE', 'UPPER-PULL',
  'AEROBIC-MOBILITY', 'PUMP-BALANCE',
] as const;
export type SessionArchetype = (typeof ARCHETYPES)[number];

export const BLOCK_KINDS = [
  'primer', 'main', 'secondary', 'superset', 'finisher', 'downregulate',
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export type SetKind = 'ramp' | 'working' | 'top';
export type Metric = 'reps' | 'distance' | 'duration';

// ---------------------------------------------------------------- exercises

export interface Exercise {
  id: string;
  name: string;
  nameSv: string;
  pattern: MovementPattern;
  tier: Tier;
  equipment: Equipment[];
  complexity: Complexity;
  unilateral: boolean;
  metric: Metric;
  /** Seconds of work per rep at a neutral tempo; used only for carries/duration work. */
  loadingSecondsPerRep: number;
  defaultTempo: string;
  repLo: number;
  repHi: number;
  cue: string;
  alternatives: string[];
  contraindications: PainArea[];
  /** Can external load be added (drives double progression vs rep progression). */
  loadable: boolean;
}

// ---------------------------------------------------------------- prescriptions

export interface PrescribedSet {
  setNumber: number;
  kind: SetKind;
  reps?: number;
  perSide?: boolean;
  weightKg?: number;
  percentTm?: number;
  rpe?: number;
  distanceM?: number;
  durationSec?: number;
  restSec: number;
  estimatedSec: number;
}

export interface BlockExercise {
  slot: string;
  exerciseId: string;
  tempo: string;
  cue: string;
  sets: PrescribedSet[];
  substitutedFrom?: string;
  /** Chosen to close a weekly balance gap — trimming removes it last. */
  structural?: boolean;
}

export interface SessionBlock {
  letter: string;
  kind: BlockKind;
  name: string;
  rounds?: number;
  note?: string;
  exercises: BlockExercise[];
  estimatedSec: number;
}

export interface PlannedSession {
  weekNumber: number;
  dayNumber: number;
  weekday: number; // 1 = Monday
  date: string; // ISO yyyy-mm-dd
  archetype: SessionArchetype;
  title: string;
  mainPattern: MovementPattern | null;
  isDeload: boolean;
  blocks: SessionBlock[];
  estimatedSec: number;
  trimLog: string[];
}

export interface PlannedWeek {
  weekNumber: number;
  isDeload: boolean;
  sessions: PlannedSession[];
}

export interface Program {
  name: string;
  generatorVersion: string;
  weeks: number;
  daysPerWeek: number;
  startDate: string;
  input: GeneratorInput;
  plan: PlannedWeek[];
}

// ---------------------------------------------------------------- input

export interface GeneratorInput {
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  experience: Experience;
  equipment: Equipment[];
  sessionCapSec: number;
  mesocycleWeeks: 4 | 6;
  /** exerciseId -> training max in kg */
  trainingMaxes: Record<string, number>;
  preferredWeekdays: number[];
  allowAdvanced: boolean;
  painFlags: PainArea[];
  microPlates: boolean;
  bodyweightKg: number;
  paceFactor: number;
  startDate: string;
  seed: number;
}

export interface Readiness {
  sleep: number;
  soreness: number;
  stress: number;
}

export interface LoggedSetInput {
  sessionId: string;
  blockLetter: string;
  slot: string;
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weightKg?: number;
  rpe?: number;
  distanceM?: number;
  durationSec?: number;
  skipped: boolean;
  painFlag?: PainArea | null;
  clientLoggedAt: string;
}

// ---------------------------------------------------------------- errors

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class SessionOverBudgetError extends DomainError {
  constructor(details: Record<string, unknown>) {
    super('SESSION_OVER_BUDGET', 'Session cannot fit inside the time cap', details);
  }
}

export class BalanceUnsatisfiableError extends DomainError {
  constructor(details: Record<string, unknown>) {
    super('BALANCE_UNSATISFIABLE', 'Weekly balance constraints could not be satisfied', details);
  }
}

export class NoSubstituteError extends DomainError {
  constructor(details: Record<string, unknown>) {
    super('NO_SUBSTITUTE', 'No suitable substitute movement available', details);
  }
}

// ---------------------------------------------------------------- rng

/** Deterministic, seedable PRNG so a program can be regenerated byte-identically. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
