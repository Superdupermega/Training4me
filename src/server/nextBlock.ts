import 'server-only';
import { today } from '@/core/dates';
import { getExercise } from '@/core/library/exercises';
import { nextTrainingMax } from '@/core/progression/trainingMax';
import * as repo from './repo';

export type TmChange = { exerciseId: string; from: number; to: number; reason: string };

/**
 * A training max set directly from a chunk-26 test week rather than
 * inferred from the peak week's top set — `exerciseId` skips the inferred
 * path entirely below, `value` and `reason` are written as-is (the reason
 * string is how `/program/complete`'s retrospective tells a tested change
 * apart from an inferred one — see docs/chunks/chunk-26-test-week.md §5).
 */
export interface TestedOverride {
  exerciseId: string;
  value: number;
  reason: string;
}

/**
 * At the end of a block, the top set of the heaviest week decides where each
 * training max goes next. Nothing moves on feel alone.
 *
 * `program` is the finished block to roll over — the *normal* caller
 * (`startNextBlock`) passes whatever is still `active`, but the test-week
 * apply path (`applyTestWeekResults`) cannot: by the time it runs, the test
 * week itself is the active program, and the block being rolled over is its
 * parent. Taking it as a parameter rather than calling `getActiveProgram()`
 * internally is what lets both paths share this one function instead of
 * diverging into two implementations of "start the next block" — see
 * docs/DECISIONS.md, chunk 26.
 */
export async function rollOverTrainingMaxes(
  program: repo.ProgramRow | null,
  testedOverrides: TestedOverride[] = [],
): Promise<TmChange[]> {
  if (!program) return [];

  const [sessions, logs, profile] = await Promise.all([
    repo.listSessions(program.id),
    repo.getLogsForProgram(program.id),
    repo.getProfile(),
  ]);
  const currentMaxes = await repo.getTrainingMaxes(profile.timezone);

  const changes: TmChange[] = [];
  const progressedValues: Record<string, number> = {};
  const testedValues: Record<string, number> = {};

  // Tested lifts are decided already — skip inference for them entirely,
  // below, rather than let a peak-week top set second-guess a real attempt.
  const overrideIds = new Set(testedOverrides.map((o) => o.exerciseId));
  for (const override of testedOverrides) {
    const current = currentMaxes[override.exerciseId];
    if (current == null) continue; // never had a max on file — nothing to roll from
    testedValues[override.exerciseId] = override.value;
    changes.push({ exerciseId: override.exerciseId, from: current, to: override.value, reason: override.reason });
  }

  const peakWeek = program.weeks === 4 ? 3 : 5;
  const peakSessionIds = new Set(
    sessions.filter((s) => s.weekNumber === peakWeek).map((s) => s.id),
  );

  for (const session of sessions.filter((s) => peakSessionIds.has(s.id) && s.mainPattern)) {
    const mainBlock = session.blocks.find((b) => b.kind === 'main');
    const be = mainBlock?.exercises[0];
    if (!be || overrideIds.has(be.exerciseId)) continue;
    const current = currentMaxes[be.exerciseId];
    if (!current) continue;

    const target = be.sets.filter((s) => s.kind !== 'ramp');
    const logged = logs.filter(
      (l) => l.session_id === session.id && l.exercise_id === be.exerciseId && !l.skipped,
    );
    if (logged.length === 0) continue;

    const topTarget = target[target.length - 1];
    const topLogged = logged[logged.length - 1];
    const allReps = logged.length >= target.length
      && logged.every((l, i) => (l.reps ?? 0) >= (target[i]?.reps ?? 0));

    const verdict = nextTrainingMax(current, be.exerciseId, {
      allRepsCompleted: allReps && (topLogged?.reps ?? 0) >= (topTarget?.reps ?? 0),
      rpe: topLogged?.rpe != null ? Number(topLogged.rpe) : null,
    });
    progressedValues[be.exerciseId] = verdict.next;
    changes.push({
      exerciseId: be.exerciseId,
      from: current,
      to: verdict.next,
      reason: `${getExercise(be.exerciseId).name}: ${verdict.reason}`,
    });
  }

  const effectiveFrom = today(profile.timezone);
  await repo.setTrainingMaxes(progressedValues, 'progressed', effectiveFrom);
  await repo.setTrainingMaxes(testedValues, 'tested', effectiveFrom);
  return changes;
}
