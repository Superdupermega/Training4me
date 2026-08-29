import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Routine, RoutineDay, RoutineItem, TargetKind } from '@/core/builder/types';
import { materializeRoutine } from '@/core/builder/materializeRoutine';
import { reconcileProgram } from '@/core/builder/reconcileProgram';
import type { BlockKind, PlannedSession } from '@/core/types';
import { db } from './db';

/**
 * A second tag, alongside repo.ts's `profile`/`program`/`sessions`/`logs` —
 * routines are their own resource. Cache invalidation for it, like every
 * other tag, is called from actions.ts, not from here — this file mirrors
 * repo.ts's own read/write-only discipline (chunk 14).
 */
export const ROUTINE_TAG = 'routines';

export interface RoutineListItem {
  id: string;
  name: string;
  description: string | null;
  source: 'custom' | 'generated';
  weeks: number;
  daysPerWeek: number;
  updatedAt: string;
}

interface RoutineRecord {
  id: string; name: string; description: string | null; source: string;
  weeks: number; days_per_week: number; archived_at: string | null; updated_at: string;
}
interface RoutineDayRecord {
  id: string; routine_id: string; day_index: number; name: string; weekday: number | null; notes: string | null;
}
interface RoutineItemRecord {
  id: string; day_id: string; position: number; block_letter: string; block_kind: string;
  superset_group: string | null; exercise_id: string; sets: number;
  rep_lo: number | null; rep_hi: number | null; tempo: string; rest_sec: number;
  target_kind: string; percent_tm: number | null; rpe: number | null; weight_kg: number | null;
  duration_sec: number | null; distance_m: number | null; per_side: boolean; notes: string | null;
}

const toItem = (r: RoutineItemRecord): RoutineItem => ({
  id: r.id, position: r.position, blockLetter: r.block_letter, blockKind: r.block_kind as BlockKind,
  supersetGroup: r.superset_group, exerciseId: r.exercise_id, sets: r.sets,
  repLo: r.rep_lo, repHi: r.rep_hi, tempo: r.tempo, restSec: r.rest_sec,
  targetKind: r.target_kind as TargetKind, percentTm: r.percent_tm != null ? Number(r.percent_tm) : null,
  rpe: r.rpe != null ? Number(r.rpe) : null, weightKg: r.weight_kg != null ? Number(r.weight_kg) : null,
  durationSec: r.duration_sec, distanceM: r.distance_m, perSide: r.per_side, notes: r.notes,
});

export const listRoutines = unstable_cache(
  async (): Promise<RoutineListItem[]> => {
    const { data, error } = await db()
      .from('t4m_routine').select('*').is('archived_at', null)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: RoutineRecord) => ({
      id: r.id, name: r.name, description: r.description, source: r.source as 'custom' | 'generated',
      weeks: r.weeks, daysPerWeek: r.days_per_week, updatedAt: r.updated_at,
    }));
  },
  ['t4m-list-routines'],
  { tags: [ROUTINE_TAG] },
);

export const getRoutine = unstable_cache(
  async (id: string): Promise<Routine | null> => {
    const client = db();
    const { data: routine, error: routineError } = await client
      .from('t4m_routine').select('*').eq('id', id).maybeSingle();
    if (routineError) throw new Error(routineError.message);
    if (!routine) return null;

    const { data: dayRows, error: dayError } = await client
      .from('t4m_routine_day').select('*').eq('routine_id', id).order('day_index');
    if (dayError) throw new Error(dayError.message);
    const days = (dayRows ?? []) as RoutineDayRecord[];

    const dayIds = days.map((d) => d.id);
    const { data: itemRows, error: itemError } = dayIds.length
      ? await client.from('t4m_routine_item').select('*').in('day_id', dayIds).order('position')
      : { data: [] as RoutineItemRecord[], error: null };
    if (itemError) throw new Error(itemError.message);
    const items = (itemRows ?? []) as RoutineItemRecord[];

    const routineDays: RoutineDay[] = days.map((d) => ({
      id: d.id, dayIndex: d.day_index, name: d.name, weekday: d.weekday, notes: d.notes,
      items: items.filter((i) => i.day_id === d.id).map(toItem),
    }));

    return {
      id: routine.id, name: routine.name, description: routine.description,
      weeks: routine.weeks, daysPerWeek: routine.days_per_week, days: routineDays,
    };
  },
  ['t4m-get-routine'],
  { tags: [ROUTINE_TAG] },
);

export interface CreateRoutineInput {
  name: string;
  description?: string | null;
  weeks: number;
  daysPerWeek: number;
}

/** Creates the routine plus one empty day per `daysPerWeek`, ready to fill in. */
export async function createRoutine(input: CreateRoutineInput): Promise<string> {
  const client = db();
  const { data, error } = await client.from('t4m_routine').insert({
    name: input.name, description: input.description ?? null,
    weeks: input.weeks, days_per_week: input.daysPerWeek, source: 'custom',
  }).select('id').single();
  if (error) throw new Error(error.message);

  const days = Array.from({ length: input.daysPerWeek }, (_, i) => ({
    routine_id: data.id, day_index: i + 1, name: `Day ${i + 1}`, weekday: i + 1,
  }));
  const { error: dayError } = await client.from('t4m_routine_day').insert(days);
  if (dayError) throw new Error(dayError.message);

  return data.id;
}

export async function renameRoutine(routineId: string, name: string): Promise<void> {
  const { error } = await db().from('t4m_routine')
    .update({ name, updated_at: new Date().toISOString() }).eq('id', routineId);
  if (error) throw new Error(error.message);
}

export async function archiveRoutine(routineId: string): Promise<void> {
  const { error } = await db().from('t4m_routine')
    .update({ archived_at: new Date().toISOString() }).eq('id', routineId);
  if (error) throw new Error(error.message);
}

/**
 * Replace-all: delete every day (items cascade) for this routine and
 * re-insert from scratch. Simpler and safer than diffing a reordered,
 * added-to, deleted-from tree of days and items against what is stored —
 * the same trade-off `persistProgram` makes for the generator's own output.
 */
export async function saveRoutineDays(routineId: string, days: RoutineDay[]): Promise<void> {
  const client = db();
  const { error: deleteError } = await client.from('t4m_routine_day').delete().eq('routine_id', routineId);
  if (deleteError) throw new Error(deleteError.message);

  const dayRows = days.map((d) => ({
    routine_id: routineId, day_index: d.dayIndex, name: d.name, weekday: d.weekday, notes: d.notes,
  }));
  const { data: insertedDays, error: dayError } = await client
    .from('t4m_routine_day').insert(dayRows).select('id, day_index');
  if (dayError) throw new Error(dayError.message);

  const idByIndex = new Map((insertedDays ?? []).map((d: { id: string; day_index: number }) => [d.day_index, d.id]));
  const itemRows = days.flatMap((d) => {
    const dayId = idByIndex.get(d.dayIndex);
    if (!dayId) return [];
    return d.items.map((item) => ({
      day_id: dayId, position: item.position, block_letter: item.blockLetter, block_kind: item.blockKind,
      superset_group: item.supersetGroup, exercise_id: item.exerciseId, sets: item.sets,
      rep_lo: item.repLo, rep_hi: item.repHi, tempo: item.tempo, rest_sec: item.restSec,
      target_kind: item.targetKind, percent_tm: item.percentTm, rpe: item.rpe, weight_kg: item.weightKg,
      duration_sec: item.durationSec, distance_m: item.distanceM, per_side: item.perSide, notes: item.notes,
    }));
  });
  if (itemRows.length > 0) {
    const { error: itemError } = await client.from('t4m_routine_item').insert(itemRows);
    if (itemError) throw new Error(itemError.message);
  }

  await client.from('t4m_routine').update({ updated_at: new Date().toISOString() }).eq('id', routineId);
}

/**
 * Every column of a materialised session bar its identity — shared by
 * `scheduleRoutine` (which inserts a whole block of them) and
 * `updateProgramFromRoutine` (which re-inserts only the ones still ahead of
 * the athlete), so the two can never drift into materialising a session
 * differently.
 */
function sessionRow(programId: string, routineId: string, s: PlannedSession) {
  return {
    program_id: programId, week_number: s.weekNumber, day_number: s.dayNumber, weekday: s.weekday,
    scheduled_date: s.date, archetype: s.archetype, title: s.title, main_pattern: s.mainPattern,
    is_deload: s.isDeload, estimated_sec: s.estimatedSec, blocks: s.blocks, status: 'planned',
    routine_id: routineId,
  };
}

export interface ScheduleRoutineArgs {
  startDate: string;
  trainingMaxes: Record<string, number>;
  increment: number;
  paceFactor: number;
}

/**
 * Materialises the routine and makes it the active program — the same
 * contract `buildProgram`/`persistProgram` in actions.ts/repo.ts follow for
 * a generated block, so the session player needs no changes at all to play
 * a self-built one.
 */
export async function scheduleRoutine(routine: Routine, args: ScheduleRoutineArgs): Promise<string> {
  const client = db();
  const plan = materializeRoutine(routine, args);

  await client.from('t4m_program').update({ status: 'abandoned' }).eq('status', 'active');

  const { data: program, error: programError } = await client.from('t4m_program').insert({
    name: routine.name, weeks: routine.weeks, days_per_week: routine.daysPerWeek,
    start_date: args.startDate, generator_version: 'builder-1.0.0',
    input: { routineId: routine.id, source: 'custom' }, status: 'active', routine_id: routine.id,
  }).select('id').single();
  if (programError) throw new Error(programError.message);

  const rows = plan.flatMap((week) => week.sessions.map((s) => sessionRow(program.id, routine.id, s)));
  const { error: sessionError } = await client.from('t4m_session').insert(rows);
  if (sessionError) {
    await client.from('t4m_program').delete().eq('id', program.id);
    throw new Error(sessionError.message);
  }

  return program.id;
}

/**
 * Only the columns `updateProgramFromRoutine` reasons about — the rest ride
 * along under the index signature so a row can be re-inserted verbatim if
 * the replacement insert fails.
 */
interface ProgramSessionRecord {
  id: string;
  week_number: number;
  day_number: number;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
  [column: string]: unknown;
}

export interface UpdateProgramResult {
  /** Sessions re-materialised from the edited routine. */
  rewritten: number;
  /** Sessions left exactly as they were, because they are already history. */
  kept: number;
}

/**
 * Edit a program *while you are training it*.
 *
 * Re-materialises the routine over the block already in flight instead of
 * starting a new one: every session you have not touched yet is rewritten
 * from the edited routine, and every session that is part of your history —
 * finished, in progress, deliberately skipped, or holding logged sets from
 * an offline replay — is left exactly as it was. The program row itself, its
 * start date, and its logged history all survive, which is the whole
 * difference between this and `scheduleRoutine`: that one abandons the
 * active block and starts a fresh one from today.
 *
 * The dates come out identical because the plan is re-materialised from the
 * program's own `start_date`, not from today — week 3 Wednesday stays week 3
 * Wednesday, with new content.
 */
export async function updateProgramFromRoutine(
  programId: string, routine: Routine, args: ScheduleRoutineArgs,
): Promise<UpdateProgramResult> {
  const client = db();

  const { data: existingRows, error: readError } = await client
    .from('t4m_session').select('*').eq('program_id', programId);
  if (readError) throw new Error(readError.message);
  const existing = (existingRows ?? []) as ProgramSessionRecord[];

  // A session still marked `planned` can nonetheless hold logged sets — one
  // that arrived out of the offline outbox after a failed `beginSession`.
  // Deleting it would cascade those sets away, so `reconcileProgram` needs
  // to know before it decides anything.
  const plannedIds = existing.filter((e) => e.status === 'planned').map((e) => e.id);
  const withLogs = new Set<string>();
  if (plannedIds.length > 0) {
    const { data: logRows, error: logError } = await client
      .from('t4m_logged_set').select('session_id').in('session_id', plannedIds);
    if (logError) throw new Error(logError.message);
    for (const row of (logRows ?? []) as { session_id: string }[]) withLogs.add(row.session_id);
  }

  const { replaceIds, kept, insert, weeks } = reconcileProgram(
    materializeRoutine(routine, args),
    existing.map((e) => ({
      id: e.id, weekNumber: e.week_number, dayNumber: e.day_number,
      status: e.status, hasLoggedSets: withLogs.has(e.id),
    })),
    routine.weeks,
  );
  const rows = insert.map((s) => sessionRow(programId, routine.id, s));

  if (replaceIds.length > 0) {
    const { error } = await client.from('t4m_session').delete().in('id', replaceIds);
    if (error) throw new Error(error.message);
  }
  if (rows.length > 0) {
    const { error } = await client.from('t4m_session').insert(rows);
    if (error) {
      // Put back exactly what was deleted, ids and all, rather than leaving
      // the athlete with a program missing the weeks ahead of them. There is
      // no transaction to be had through PostgREST, so this is the
      // compensation for the one step that can fail after a destructive one.
      if (replaceIds.length > 0) {
        await client.from('t4m_session').insert(existing.filter((e) => replaceIds.includes(e.id)));
      }
      throw new Error(error.message);
    }
  }

  // The program row follows the routine — its name, its shape, and a length
  // that can only grow (see `reconcileProgram`). `routine_id` is written
  // unconditionally so that a generated block adopted into this routine
  // (see `updateLiveProgram`) is a routine-backed program from here on, and
  // editable in place like any other.
  const { error: programError } = await client.from('t4m_program')
    .update({ name: routine.name, days_per_week: routine.daysPerWeek, weeks, routine_id: routine.id })
    .eq('id', programId);
  if (programError) throw new Error(programError.message);

  return { rewritten: rows.length, kept: kept.length };
}
