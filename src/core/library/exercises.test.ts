import { describe, expect, it } from 'vitest';
import { BY_ID, EXERCISES } from './exercises';
import { PROFILE_EQUIPMENT } from './equipment';
import { find, substitute } from './query';
import { COMPLEXITIES, PATTERNS, TIERS, type EquipmentProfile, type MovementPattern } from '../types';
import { MUSCLES, MUSCLE_GROUPS, EXERCISE_STYLES, GROUP_MUSCLES, type Muscle } from './muscles';

const ctx = (profile: EquipmentProfile) => ({
  equipment: PROFILE_EQUIPMENT[profile], painFlags: [], allowAdvanced: false,
});

describe('exercise library', () => {
  it('is big enough to program from', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(70);
  });

  it('has unique, kebab-case ids', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('only uses known taxonomy values', () => {
    for (const e of EXERCISES) {
      expect(PATTERNS).toContain(e.pattern);
      expect(TIERS).toContain(e.tier);
      expect(COMPLEXITIES).toContain(e.complexity);
      expect(e.repLo).toBeLessThanOrEqual(e.repHi);
      expect(e.cue.length).toBeGreaterThan(10);
      expect(e.nameSv.length).toBeGreaterThan(2);
    }
  });

  it('never references a movement that does not exist', () => {
    for (const e of EXERCISES) {
      for (const alt of e.alternatives) expect(BY_ID.has(alt), `${e.id} -> ${alt}`).toBe(true);
      expect(e.alternatives).not.toContain(e.id);
    }
  });

  it('gives every main and secondary lift somewhere to go', () => {
    for (const e of EXERCISES.filter((x) => x.tier === 'T1' || x.tier === 'T2')) {
      expect(e.alternatives.length, e.id).toBeGreaterThanOrEqual(2);
    }
  });

  /**
   * The generator must never select a skill-gated movement unsupervised
   * (chunk 16 §3). This replaces the old blunt banned-word test — that one
   * blocked legitimate library movements (a KB clean, a pistol squat) from
   * ever existing at all, which is more than the rule needs. The real
   * requirement is just that a skill-gated movement is both advanced and
   * outside the generator's reach — enforced together, not by convention.
   */
  it('never lets the generator select a skill-gated movement', () => {
    const skillGated = EXERCISES.filter((e) => e.skillGated);
    expect(skillGated.length).toBeGreaterThan(0);
    for (const e of skillGated) {
      expect(e.complexity, e.id).toBe('advanced');
      expect(e.inGeneratorPool, e.id).toBe(false);
    }
  });

  const MAIN: MovementPattern[] = ['squat', 'hinge', 'push_h', 'push_v', 'pull_h', 'pull_v'];

  it.each(MAIN)('has at least six ways to train %s', (pattern) => {
    expect(EXERCISES.filter((e) => e.pattern === pattern).length).toBeGreaterThanOrEqual(6);
  });

  it.each(Object.keys(PROFILE_EQUIPMENT) as EquipmentProfile[])(
    'can still train every main pattern with %s',
    (profile) => {
      for (const pattern of MAIN) {
        expect(find(ctx(profile), { pattern }).length, `${profile}/${pattern}`).toBeGreaterThan(0);
      }
    },
  );

  // ---------------------------------------------------------- chunk 16: library expansion

  it('never lets the generator pool grow by accident', () => {
    // 101 is exactly the movement count the generator, balance rules and
    // volume bands were tuned against before the library expansion. Every
    // movement chunk 16 adds ships `inGeneratorPool: false`; this tripwire
    // fails loudly if one is ever left without it.
    const pool = EXERCISES.filter((e) => e.inGeneratorPool !== false);
    expect(pool.length).toBe(101);
  });

  it('has at least ~280 movements across the library', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(280);
  });

  it('gives every movement real, valid muscle data', () => {
    for (const e of EXERCISES) {
      expect(e.primaryMuscles.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.primaryMuscles.length, e.id).toBeLessThanOrEqual(3);
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) {
        expect(MUSCLES, `${e.id} -> ${m}`).toContain(m);
      }
      for (const m of e.primaryMuscles) {
        expect(e.secondaryMuscles, `${e.id}: ${m} in both primary and secondary`).not.toContain(m);
      }
      expect(EXERCISE_STYLES, e.id).toEqual(expect.arrayContaining(e.styles));
    }
  });

  it('populates every muscle group with a real number of movements', () => {
    const minByGroup: Record<string, number> = {
      chest: 20, back: 30, shoulders: 25, arms: 25, core: 20,
      quads: 25, hamstrings_glutes: 25, calves: 8,
      carry_grip: 10, cardio: 10, mobility: 18, full_body: 8,
    };
    for (const group of MUSCLE_GROUPS) {
      const muscles = GROUP_MUSCLES[group];
      const count = EXERCISES.filter((e) => (
        muscles.some((m) => e.primaryMuscles.includes(m))
        || (group === 'mobility' && e.pattern === 'mobility')
        || (group === 'cardio' && e.pattern === 'aerobic')
        || (group === 'full_body' && e.isFullBody)
      )).length;
      expect(count, group).toBeGreaterThanOrEqual(minByGroup[group]!);
    }
  });

  it('has a real Functional Bodybuilding (Marcus Filly) set', () => {
    const fb = EXERCISES.filter((e) => e.styles.includes('functional_bodybuilding'));
    expect(fb.length).toBeGreaterThanOrEqual(50);
  });

  it('keeps howTo steps short and real, where present', () => {
    for (const e of EXERCISES) {
      if (!e.howTo) continue;
      expect(e.howTo.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.howTo.length, e.id).toBeLessThanOrEqual(5);
      for (const step of e.howTo) expect(step.length, e.id).toBeGreaterThanOrEqual(15);
    }
  });

});

describe('substitution', () => {
  it('stays in the same pattern when the rack is missing', () => {
    const alt = substitute('back-squat', { equipment: ['dumbbell', 'bench', 'none'], painFlags: [], allowAdvanced: false });
    expect(alt.pattern).toBe('squat');
    expect(alt.id).not.toBe('back-squat');
  });

  it('respects a pain flag', () => {
    const alt = substitute('back-squat', { equipment: PROFILE_EQUIPMENT.full_gym, painFlags: ['knee'], allowAdvanced: false });
    expect(alt.contraindications).not.toContain('knee');
  });

  it('honours an exclusion list', () => {
    const first = substitute('bench-press', ctx('full_gym'));
    const second = substitute('bench-press', ctx('full_gym'), [first.id]);
    expect(second.id).not.toBe(first.id);
  });

  it('never substitutes in a library-only (non-pool) movement', () => {
    for (const profile of Object.keys(PROFILE_EQUIPMENT) as EquipmentProfile[]) {
      for (const seed of ['back-squat', 'bench-press', 'barbell-row', 'deadlift'] as const) {
        const alt = substitute(seed, ctx(profile));
        expect(alt.inGeneratorPool, `${profile}/${seed} -> ${alt.id}`).not.toBe(false);
      }
    }
  });
});

describe('muscle taxonomy', () => {
  it('every group muscle is a real muscle', () => {
    for (const group of MUSCLE_GROUPS) {
      for (const m of GROUP_MUSCLES[group]) expect(MUSCLES, `${group} -> ${m}`).toContain(m as Muscle);
    }
  });
});
