import 'server-only';
import { unstable_cache } from 'next/cache';
import { getExercise } from '@/core/library/exercises';
import { ANCHOR, epley, resolveTrainingMax } from '@/core/progression/trainingMax';
import { roundToIncrement } from '@/core/progression/waves';
import type { MovementPattern } from '@/core/types';
import { db } from './db';
import { TAGS, getTrainingMaxes } from './repo';

export interface ExerciseContext {
  exerciseId: string;
  last: {
    date: string;
    daysAgo: number;
    sessionTitle: string | null;
    topSet: { weightKg: number | null; reps: number | null; rpe: number | null };
    allSets: { weightKg: number | null; reps: number | null; rpe: number | null }[];
    totalVolumeKg: number;
  } | null;
  best: { e1rm: number; weightKg: number; reps: number; date: string } | null;
  /** Direct TM, or derived from the pattern anchor via resolveTrainingMax. */
  trainingMax: { valueKg: number; derivedFrom: string | null } | null;
  /** What the app would prescribe: TM × percent, rounded to the increment. */
  expected: { percentTm: number; weightKg: number; repRange: [number, number] } | null;
}

interface LoggedRow {
  session_id: string; exercise_id: string; set_number: number;
  reps: number | null; weight_kg: string | number | null; rpe: string | number | null;
  created_at: string;
}

const DEFAULT_PERCENT_TM = 75;

function emptyContext(exerciseId: string): ExerciseContext {
  return { exerciseId, last: null, best: null, trainingMax: null, expected: null };
}

/**
 * Batched — one query for every id, not one per exercise. A picker screen
 * calls this with 30+ ids at once; an N+1 here would undo chunk 14's whole
 * performance pass.
 */
async function loadContexts(
  exerciseIds: string[], increment: number, percentTm: number,
): Promise<Record<string, ExerciseContext>> {
  if (exerciseIds.length === 0) return {};
  const client = db();

  const [{ data: logs, error: logsError }, trainingMaxes] = await Promise.all([
    client
      .from('t4m_logged_set').select('session_id, exercise_id, set_number, reps, weight_kg, rpe, created_at')
      .in('exercise_id', exerciseIds).eq('skipped', false)
      .order('created_at', { ascending: false }).limit(1000),
    // Uses getTrainingMaxes' default timezone rather than threading
    // profile.timezone through this batched, N+1-sensitive hot path — the
    // window where that would matter is the same hour or two each evening
    // this whole fix (docs/07-PRODUCTION-REVIEW.md #7) closes for
    // everywhere the athlete actually sees "today", and even then only
    // affects which of two adjacent days' training-max rows shows here.
    getTrainingMaxes(),
  ]);
  if (logsError) throw new Error(logsError.message);
  const rows = (logs ?? []) as LoggedRow[];

  const bySessionThenExercise = new Map<string, LoggedRow[]>(); // key: `${exerciseId}:${sessionId}`
  const byExercise = new Map<string, LoggedRow[]>();
  for (const row of rows) {
    byExercise.set(row.exercise_id, [...(byExercise.get(row.exercise_id) ?? []), row]);
    const key = `${row.exercise_id}:${row.session_id}`;
    bySessionThenExercise.set(key, [...(bySessionThenExercise.get(key) ?? []), row]);
  }

  // The most recent session per exercise (rows are already newest-first).
  const lastSessionByExercise = new Map<string, string>();
  for (const row of rows) {
    if (!lastSessionByExercise.has(row.exercise_id)) lastSessionByExercise.set(row.exercise_id, row.session_id);
  }
  const lastSessionIds = [...new Set(lastSessionByExercise.values())];
  const { data: sessionRows, error: sessionError } = lastSessionIds.length
    ? await client.from('t4m_session').select('id, title').in('id', lastSessionIds)
    : { data: [] as { id: string; title: string }[], error: null };
  if (sessionError) throw new Error(sessionError.message);
  const titleBySessionId = new Map((sessionRows ?? []).map((s) => [s.id, s.title]));

  const now = Date.now();
  const out: Record<string, ExerciseContext> = {};

  for (const exerciseId of exerciseIds) {
    const exercise = getExercise(exerciseId);
    const ctx = emptyContext(exerciseId);

    const lastSessionId = lastSessionByExercise.get(exerciseId);
    if (lastSessionId) {
      const sets = (bySessionThenExercise.get(`${exerciseId}:${lastSessionId}`) ?? [])
        .slice().sort((a, b) => a.set_number - b.set_number);
      const first = sets[0]!;
      const topSet = sets.reduce((best, s) => (
        Number(s.weight_kg ?? 0) > Number(best.weight_kg ?? 0) ? s : best
      ), first);
      const daysAgo = Math.round((now - new Date(first.created_at).getTime()) / 86_400_000);
      ctx.last = {
        date: first.created_at.slice(0, 10), daysAgo,
        sessionTitle: titleBySessionId.get(lastSessionId) ?? null,
        topSet: {
          weightKg: topSet.weight_kg != null ? Number(topSet.weight_kg) : null,
          reps: topSet.reps, rpe: topSet.rpe != null ? Number(topSet.rpe) : null,
        },
        allSets: sets.map((s) => ({
          weightKg: s.weight_kg != null ? Number(s.weight_kg) : null,
          reps: s.reps, rpe: s.rpe != null ? Number(s.rpe) : null,
        })),
        totalVolumeKg: sets.reduce((sum, s) => sum + Number(s.weight_kg ?? 0) * (s.reps ?? 0), 0),
      };
    }

    const loadableSets = (byExercise.get(exerciseId) ?? []).filter((s) => s.weight_kg != null && s.reps);
    if (loadableSets.length > 0) {
      const best = loadableSets.reduce((acc, s) => {
        const e1rm = epley(Number(s.weight_kg), s.reps!);
        return !acc || e1rm > acc.e1rm ? { e1rm, row: s } : acc;
      }, null as { e1rm: number; row: LoggedRow } | null)!;
      ctx.best = {
        e1rm: Math.round(best.e1rm * 10) / 10, weightKg: Number(best.row.weight_kg),
        reps: best.row.reps!, date: best.row.created_at.slice(0, 10),
      };
    }

    const tmValue = resolveTrainingMax(exerciseId, exercise.pattern as MovementPattern, trainingMaxes);
    if (tmValue) {
      const derivedFrom = trainingMaxes[exerciseId] ? null : (ANCHOR[exercise.pattern] ?? null);
      ctx.trainingMax = { valueKg: tmValue, derivedFrom };
      ctx.expected = {
        percentTm,
        weightKg: roundToIncrement(tmValue * (percentTm / 100), increment),
        repRange: [exercise.repLo, exercise.repHi],
      };
    }

    out[exerciseId] = ctx;
  }

  return out;
}

/**
 * Wrapped once at module scope, per Next's own convention — the sorted id
 * array (and the two numeric args) are ordinary function arguments, which
 * `unstable_cache` serialises into the cache key automatically. A fresh
 * `unstable_cache(...)` call per invocation would work too (the platform
 * cache is keyed on the serialised call, not on JS object identity) but
 * this is the documented shape and avoids re-wrapping on every call.
 */
const cachedLoadContexts = unstable_cache(
  loadContexts,
  ['t4m-exercise-context'],
  { tags: [TAGS.logs, TAGS.profile] },
);

export async function exerciseContext(
  exerciseIds: string[],
  opts?: { percentTm?: number; increment?: number },
): Promise<Record<string, ExerciseContext>> {
  const ids = [...new Set(exerciseIds)].sort();
  if (ids.length === 0) return {};
  return cachedLoadContexts(ids, opts?.increment ?? 2.5, opts?.percentTm ?? DEFAULT_PERCENT_TM);
}
