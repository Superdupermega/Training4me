import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { PROFILE_EQUIPMENT } from '../library/equipment';
import type { LibraryContext } from '../library/query';
import { waveFor } from '../progression/waves';
import type { GeneratorInput, PlannedWeek, Program } from '../types';
import { BalanceUnsatisfiableError, mulberry32 } from '../types';
import { assembleSession } from './assembleSession';
import { emptyWeekState, type GenContext } from './context';
import { repairWeek, validateWeek } from './balance';
import { rematerializeWeek } from './materialize';
import { buildWeekSkeleton } from './split';

export const GENERATOR_VERSION = 'gen-1.0.0';
export const MAX_REPAIRS = 12;

function dateFor(startDate: string, weekNumber: number, weekday: number): string {
  const monday = startOfWeek(parseISO(startDate), { weekStartsOn: 1 });
  return format(addDays(monday, (weekNumber - 1) * 7 + (weekday - 1)), 'yyyy-MM-dd');
}

export function generateProgram(input: GeneratorInput): Program {
  const rng = mulberry32(input.seed);
  const ctx: GenContext = {
    equipment: input.equipment,
    painFlags: input.painFlags,
    allowAdvanced: input.allowAdvanced,
    trainingMaxes: input.trainingMaxes,
    increment: input.microPlates ? 1.25 : 2.5,
    sessionCapSec: input.sessionCapSec,
    paceFactor: input.paceFactor,
    experience: input.experience,
  };
  const lib: LibraryContext = {
    equipment: input.equipment,
    painFlags: input.painFlags,
    allowAdvanced: input.allowAdvanced,
  };

  const skeleton = buildWeekSkeleton(input.daysPerWeek, input.preferredWeekdays);
  const wave = waveFor(input.mesocycleWeeks);

  // Week one decides the movements for the whole block.
  const state = emptyWeekState();
  const sessions = skeleton.map((day) =>
    assembleSession({
      day, weekNumber: 1, weeks: input.mesocycleWeeks,
      date: dateFor(input.startDate, 1, day.weekday), ctx, state, rng,
    }),
  );

  let first: PlannedWeek = { weekNumber: 1, isDeload: wave[0]?.isDeload ?? false, sessions };
  let violations = validateWeek(first, input.daysPerWeek, lib);
  for (let i = 0; i < MAX_REPAIRS && violations.length > 0; i += 1) {
    const repaired = repairWeek(first, violations, ctx, lib, rng);
    if (!repaired) break;
    first = repaired;
    violations = validateWeek(first, input.daysPerWeek, lib);
  }
  if (violations.length > 0) {
    throw new BalanceUnsatisfiableError({
      weekNumber: 1, daysPerWeek: input.daysPerWeek, violations,
    });
  }

  const plan: PlannedWeek[] = [first];
  for (let weekNumber = 2; weekNumber <= input.mesocycleWeeks; weekNumber += 1) {
    const week = rematerializeWeek(
      first, weekNumber, input.mesocycleWeeks,
      (w, weekday) => dateFor(input.startDate, w, weekday),
      ctx, lib, mulberry32(input.seed + weekNumber),
    );
    const remaining = validateWeek(week, input.daysPerWeek, lib, 'invariants');
    if (remaining.length > 0) {
      throw new BalanceUnsatisfiableError({ weekNumber, daysPerWeek: input.daysPerWeek, violations: remaining });
    }
    plan.push(week);
  }

  return {
    name: `${input.mesocycleWeeks} weeks · ${input.daysPerWeek} days`,
    generatorVersion: GENERATOR_VERSION,
    weeks: input.mesocycleWeeks,
    daysPerWeek: input.daysPerWeek,
    startDate: input.startDate,
    input,
    plan,
  };
}

export { PROFILE_EQUIPMENT };
