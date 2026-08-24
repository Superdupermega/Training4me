import { describe, expect, it } from 'vitest';
import { BY_ID, EXERCISES } from './exercises';
import { PROFILE_EQUIPMENT } from './equipment';
import { find, substitute } from './query';
import { COMPLEXITIES, PATTERNS, TIERS, type EquipmentProfile, type MovementPattern } from '../types';

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

  it('excludes skill-gated movements entirely', () => {
    const banned = ['snatch', 'clean', 'muscle-up', 'kipping', 'handstand', 'pistol'];
    for (const e of EXERCISES) {
      for (const word of banned) expect(e.id).not.toContain(word);
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
});
