import { describe, expect, it } from 'vitest';
import { EQUIPMENT_PROFILES, EXPERIENCES, type GeneratorInput } from '../types';
import { PROFILE_EQUIPMENT } from '../library/equipment';
import { defaultTrainingMaxes } from '../progression/trainingMax';
import { generateProgram } from './generateProgram';
import { validateWeek } from './balance';
import { getExercise } from '../library/exercises';

const DAYS = [2, 3, 4, 5, 6] as const;
const WEEKS = [4, 6] as const;

function inputFor(
  daysPerWeek: (typeof DAYS)[number],
  experience: (typeof EXPERIENCES)[number],
  profile: (typeof EQUIPMENT_PROFILES)[number],
  weeks: (typeof WEEKS)[number],
): GeneratorInput {
  return {
    daysPerWeek,
    experience,
    equipment: PROFILE_EQUIPMENT[profile],
    sessionCapSec: 3600,
    mesocycleWeeks: weeks,
    trainingMaxes: defaultTrainingMaxes(85, experience),
    preferredWeekdays: [],
    allowAdvanced: false,
    painFlags: [],
    microPlates: false,
    bodyweightKg: 85,
    paceFactor: 1,
    startDate: '2026-08-24',
    seed: 12345,
  };
}

describe('generator matrix', () => {
  const combos = DAYS.flatMap((d) =>
    EXPERIENCES.flatMap((e) => EQUIPMENT_PROFILES.flatMap((p) => WEEKS.map((w) => [d, e, p, w] as const))),
  );

  it('covers 150 combinations', () => {
    expect(combos).toHaveLength(150);
  });

  it.each(combos)('%i days / %s / %s / %i weeks generates a valid program', (d, e, p, w) => {
    const input = inputFor(d, e, p, w);
    const program = generateProgram(input);
    const lib = { equipment: input.equipment, painFlags: [], allowAdvanced: false };

    expect(program.plan).toHaveLength(w);

    for (const week of program.plan) {
      expect(week.sessions).toHaveLength(d);

      // Week one is the template: it carries the full structural guarantee.
      // Later weeks re-materialise from it, so they are checked on the
      // invariants that must hold whatever the wave does to set counts.
      const violations = validateWeek(week, d, lib, week.weekNumber === 1 ? 'full' : 'invariants');
      expect(violations, `week ${week.weekNumber}: ${JSON.stringify(violations)}`).toEqual([]);

      for (const session of week.sessions) {
        // The 60-minute promise.
        expect(session.estimatedSec, `${session.title} w${week.weekNumber}`).toBeLessThanOrEqual(3600);
        expect(session.estimatedSec).toBeGreaterThan(900);

        // Block order and unique slots.
        const letters = session.blocks.map((b) => b.letter);
        expect([...letters]).toEqual([...letters].sort());
        const slots = session.blocks.flatMap((b) => b.exercises.map((x) => x.slot));
        expect(new Set(slots).size).toBe(slots.length);

        // Every referenced exercise exists and is actually available.
        for (const block of session.blocks) {
          for (const be of block.exercises) {
            const ex = getExercise(be.exerciseId);
            expect(ex.equipment.every((item) => input.equipment.includes(item))).toBe(true);
            expect(be.sets.length).toBeGreaterThan(0);
          }
        }

        // Every week has a loaded carry unless it is a deload or there is
        // simply nothing to carry (bodyweight-only setups).
        const carryPossible = input.equipment.includes('dumbbell')
          || input.equipment.includes('kettlebell') || input.equipment.includes('trap_bar');
        if (!week.isDeload && carryPossible) {
          const weekHasCarry = week.sessions.some((s2) =>
            s2.blocks.some((b) => b.exercises.some((e) => getExercise(e.exerciseId).pattern === 'carry')),
          );
          expect(weekHasCarry).toBe(true);
        }

        // Loaded days keep exactly one main lift, and it is never trimmed away.
        if (session.mainPattern) {
          const main = session.blocks.filter((b) => b.kind === 'main');
          expect(main).toHaveLength(1);
          expect(main[0]!.exercises).toHaveLength(1);
        }
      }
    }
  });
});
