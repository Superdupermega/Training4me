import 'server-only';
import { today } from '@/core/dates';
import { getExercise } from '@/core/library/exercises';
import { nextTrainingMax } from '@/core/progression/trainingMax';
import * as repo from './repo';

/**
 * At the end of a block, the top set of the heaviest week decides where each
 * training max goes next. Nothing moves on feel alone.
 */
export async function rollOverTrainingMaxes(): Promise<
  { exerciseId: string; from: number; to: number; reason: string }[]
> {
  const program = await repo.getActiveProgram();
  if (!program) return [];

  const [sessions, logs, profile] = await Promise.all([
    repo.listSessions(program.id),
    repo.getLogsForProgram(program.id),
    repo.getProfile(),
  ]);
  const currentMaxes = await repo.getTrainingMaxes(profile.timezone);

  const peakWeek = program.weeks === 4 ? 3 : 5;
  const peakSessionIds = new Set(
    sessions.filter((s) => s.weekNumber === peakWeek).map((s) => s.id),
  );

  const changes: { exerciseId: string; from: number; to: number; reason: string }[] = [];
  const nextValues: Record<string, number> = {};

  for (const session of sessions.filter((s) => peakSessionIds.has(s.id) && s.mainPattern)) {
    const mainBlock = session.blocks.find((b) => b.kind === 'main');
    const be = mainBlock?.exercises[0];
    if (!be) continue;
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
    nextValues[be.exerciseId] = verdict.next;
    changes.push({
      exerciseId: be.exerciseId,
      from: current,
      to: verdict.next,
      reason: `${getExercise(be.exerciseId).name}: ${verdict.reason}`,
    });
  }

  await repo.setTrainingMaxes(nextValues, 'progressed', today(profile.timezone));
  return changes;
}
