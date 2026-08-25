// Muscle taxonomy — the axis the exercise library was missing entirely.
// `MovementPattern` (in ../types) answers "what kind of movement is this";
// this file answers "what does it work", which is what a browse-by-muscle-
// group screen needs and nothing in the domain vocabulary previously gave it.

export const MUSCLES = [
  'chest', 'front_delt', 'side_delt', 'rear_delt', 'rotator_cuff',
  'triceps', 'biceps', 'forearms', 'grip',
  'lats', 'mid_back', 'traps', 'lower_back',
  'abs', 'obliques', 'hip_flexors',
  'glutes', 'quads', 'hamstrings', 'adductors', 'abductors',
  'calves', 'tibialis', 'neck', 'cardio',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest', front_delt: 'Front delts', side_delt: 'Side delts', rear_delt: 'Rear delts',
  rotator_cuff: 'Rotator cuff', triceps: 'Triceps', biceps: 'Biceps', forearms: 'Forearms',
  grip: 'Grip', lats: 'Lats', mid_back: 'Mid back', traps: 'Traps', lower_back: 'Lower back',
  abs: 'Abs', obliques: 'Obliques', hip_flexors: 'Hip flexors', glutes: 'Glutes', quads: 'Quads',
  hamstrings: 'Hamstrings', adductors: 'Adductors', abductors: 'Abductors', calves: 'Calves',
  tibialis: 'Tibialis', neck: 'Neck', cardio: 'Cardio',
};

export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'arms', 'core',
  'quads', 'hamstrings_glutes', 'calves',
  'carry_grip', 'cardio', 'mobility', 'full_body',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', core: 'Core',
  quads: 'Quads', hamstrings_glutes: 'Hamstrings & glutes', calves: 'Calves',
  carry_grip: 'Carries & grip', cardio: 'Cardio', mobility: 'Mobility', full_body: 'Full body',
};

/**
 * Which muscles belong to which group. A muscle can sit in more than one
 * group when the exercises that hit it genuinely span both (grip work shows
 * up under both "Arms" and "Carries & grip", for instance) — `groupsFor`
 * below is a lookup over this, not a strict partition.
 */
export const GROUP_MUSCLES: Record<MuscleGroup, Muscle[]> = {
  chest: ['chest'],
  back: ['lats', 'mid_back', 'traps', 'lower_back', 'rear_delt'],
  shoulders: ['front_delt', 'side_delt', 'rear_delt', 'rotator_cuff'],
  arms: ['triceps', 'biceps', 'forearms', 'grip'],
  core: ['abs', 'obliques', 'hip_flexors', 'lower_back'],
  quads: ['quads', 'hip_flexors'],
  hamstrings_glutes: ['hamstrings', 'glutes', 'adductors', 'abductors'],
  calves: ['calves', 'tibialis'],
  carry_grip: ['grip', 'forearms', 'traps'],
  cardio: ['cardio'],
  mobility: [],
  full_body: [],
};

/** Derived from an exercise's primary muscles — never hand-authored per exercise. */
export function groupsFor(primary: Muscle[]): MuscleGroup[] {
  const groups = MUSCLE_GROUPS.filter((g) => GROUP_MUSCLES[g].some((m) => primary.includes(m)));
  return groups.length > 0 ? groups : [];
}

export const MECHANICS = ['compound', 'isolation'] as const;
export type Mechanic = (typeof MECHANICS)[number];

export const FORCES = ['push', 'pull', 'static', 'carry', 'locomotion'] as const;
export type Force = (typeof FORCES)[number];

export const EXERCISE_STYLES = [
  'functional_bodybuilding', 'powerlifting', 'bodybuilding',
  'strongman', 'conditioning', 'mobility', 'rehab_prehab',
] as const;
export type ExerciseStyle = (typeof EXERCISE_STYLES)[number];
