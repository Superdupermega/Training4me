import type { ExerciseStyle } from '@/core/library/muscles';
import type { Tier } from '@/core/types';

export const STYLE_LABEL: Record<ExerciseStyle, string> = {
  functional_bodybuilding: 'Functional Bodybuilding', powerlifting: 'Powerlifting',
  bodybuilding: 'Bodybuilding', strongman: 'Strongman', conditioning: 'Conditioning',
  mobility: 'Mobility', rehab_prehab: 'Rehab / prehab',
};

export const TIER_LABEL: Record<Tier, string> = {
  T1: 'Main lift', T2: 'Secondary', T3: 'Accessory', T4: 'Finisher / support',
};
