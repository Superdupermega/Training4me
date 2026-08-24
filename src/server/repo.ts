import 'server-only';
import { db, PROFILE_ID } from './db';
import type {
  Equipment, Experience, GeneratorInput, PainArea, PlannedSession, Program, SessionBlock,
} from '@/core/types';

export interface Profile {
  displayName: string | null;
  experience: Experience;
  daysPerWeek: number | null;
  sessionCapSec: number;
  equipmentProfile: string;
  equipment: Equipment[];
  allowAdvanced: boolean;
  microPlates: boolean;
  bodyweightKg: number;
  paceFactor: number;
  preferredWeekdays: number[];
  mesocycleWeeks: 4 | 6;
  onboardedAt: string | null;
}

export interface SessionRow {
  id: string;
  programId: string;
  weekNumber: number;
  dayNumber: number;
  weekday: number;
  scheduledDate: string;
  archetype: string;
  title: string;
  mainPattern: string | null;
  isDeload: boolean;
  estimatedSec: number;
  blocks: SessionBlock[];
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  actualSec: number | null;
  readiness: { sleep: number; soreness: number; stress: number } | null;
  autoregulated: boolean;
  notes: string | null;
}

export interface ProgramRow {
  id: string;
  name: string;
  weeks: number;
  daysPerWeek: number;
  startDate: string;
  status: string;
  input: GeneratorInput;
}

interface SessionRecord {
  id: string; program_id: string; week_number: number; day_number: number; weekday: number;
  scheduled_date: string; archetype: string; title: string; main_pattern: string | null;
  is_deload: boolean; estimated_sec: number; blocks: SessionBlock[];
  status: SessionRow['status']; started_at: string | null; completed_at: string | null;
  actual_sec: number | null; readiness_sleep: number | null; readiness_soreness: number | null;
  readiness_stress: number | null; autoregulated: boolean; notes: string | null;
}

const toSession = (r: SessionRecord): SessionRow => ({
  id: r.id, programId: r.program_id, weekNumber: r.week_number, dayNumber: r.day_number,
  weekday: r.weekday, scheduledDate: r.scheduled_date, archetype: r.archetype, title: r.title,
  mainPattern: r.main_pattern, isDeload: r.is_deload, estimatedSec: r.estimated_sec,
  blocks: r.blocks, status: r.status, startedAt: r.started_at, completedAt: r.completed_at,
  actualSec: r.actual_sec,
  readiness: r.readiness_sleep != null
    ? {
        sleep: r.readiness_sleep,
        soreness: r.readiness_soreness ?? 3,
        stress: r.readiness_stress ?? 3,
      }
    : null,
  autoregulated: r.autoregulated, notes: r.notes,
});

export async function getProfile(): Promise<Profile> {
  const { data, error } = await db().from('t4m_profile').select('*').eq('id', PROFILE_ID).single();
  if (error) throw new Error(error.message);
  return {
    displayName: data.display_name, experience: data.experience, daysPerWeek: data.days_per_week,
    sessionCapSec: data.session_cap_sec, equipmentProfile: data.equipment_profile,
    equipment: data.equipment ?? [], allowAdvanced: data.allow_advanced,
    microPlates: data.micro_plates, bodyweightKg: Number(data.bodyweight_kg),
    paceFactor: Number(data.pace_factor), preferredWeekdays: data.preferred_weekdays ?? [],
    mesocycleWeeks: data.mesocycle_weeks, onboardedAt: data.onboarded_at,
  };
}

export async function saveProfile(patch: Record<string, unknown>): Promise<void> {
  const { error } = await db()
    .from('t4m_profile')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', PROFILE_ID);
  if (error) throw new Error(error.message);
}

export async function getTrainingMaxes(): Promise<Record<string, number>> {
  const { data, error } = await db()
    .from('t4m_training_max').select('exercise_id, value_kg, effective_from')
    .lte('effective_from', new Date().toISOString().slice(0, 10))
    .order('effective_from', { ascending: false });
  if (error) throw new Error(error.message);
  const out: Record<string, number> = {};
  for (const row of data ?? []) if (!(row.exercise_id in out)) out[row.exercise_id] = Number(row.value_kg);
  return out;
}

export async function setTrainingMaxes(
  values: Record<string, number>,
  source: string,
  effectiveFrom = new Date().toISOString().slice(0, 10),
): Promise<void> {
  const rows = Object.entries(values).map(([exercise_id, value_kg]) => ({
    exercise_id, value_kg, source, effective_from: effectiveFrom,
  }));
  if (rows.length === 0) return;
  const { error } = await db()
    .from('t4m_training_max').upsert(rows, { onConflict: 'exercise_id,effective_from' });
  if (error) throw new Error(error.message);
}

export async function getActiveProgram(): Promise<ProgramRow | null> {
  const { data, error } = await db()
    .from('t4m_program').select('*').eq('status', 'active').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id, name: data.name, weeks: data.weeks, daysPerWeek: data.days_per_week,
    startDate: data.start_date, status: data.status, input: data.input,
  };
}

/** Replaces any active program. Planned sessions go with it; logs are kept. */
export async function persistProgram(program: Program): Promise<string> {
  const client = db();
  await client.from('t4m_program').update({ status: 'abandoned' }).eq('status', 'active');

  const { data, error } = await client.from('t4m_program').insert({
    name: program.name, weeks: program.weeks, days_per_week: program.daysPerWeek,
    start_date: program.startDate, generator_version: program.generatorVersion,
    input: program.input, status: 'active',
  }).select('id').single();
  if (error) throw new Error(error.message);

  const rows = program.plan.flatMap((week) =>
    week.sessions.map((s: PlannedSession) => ({
      program_id: data.id, week_number: s.weekNumber, day_number: s.dayNumber, weekday: s.weekday,
      scheduled_date: s.date, archetype: s.archetype, title: s.title, main_pattern: s.mainPattern,
      is_deload: s.isDeload, estimated_sec: s.estimatedSec, blocks: s.blocks, status: 'planned',
    })),
  );
  const { error: sessionError } = await client.from('t4m_session').insert(rows);
  if (sessionError) {
    await client.from('t4m_program').delete().eq('id', data.id);
    throw new Error(sessionError.message);
  }
  return data.id;
}

export async function listSessions(programId: string): Promise<SessionRow[]> {
  const { data, error } = await db()
    .from('t4m_session').select('*').eq('program_id', programId)
    .order('week_number').order('day_number');
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSession);
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const { data, error } = await db().from('t4m_session').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSession(data) : null;
}

export async function updateSession(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db().from('t4m_session').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export interface LoggedSetRow {
  sessionId: string; blockLetter: string; slot: string; exerciseId: string; setNumber: number;
  reps?: number | null; weightKg?: number | null; rpe?: number | null;
  distanceM?: number | null; durationSec?: number | null;
  skipped?: boolean; painFlag?: PainArea | null; clientLoggedAt?: string;
}

/** Idempotent on (session, block, slot, set) so an offline replay cannot duplicate. */
export async function logSets(sets: LoggedSetRow[]): Promise<void> {
  if (sets.length === 0) return;
  const rows = sets.map((s) => ({
    session_id: s.sessionId, block_letter: s.blockLetter, slot: s.slot, exercise_id: s.exerciseId,
    set_number: s.setNumber, reps: s.reps ?? null, weight_kg: s.weightKg ?? null, rpe: s.rpe ?? null,
    distance_m: s.distanceM ?? null, duration_sec: s.durationSec ?? null,
    skipped: s.skipped ?? false, pain_flag: s.painFlag ?? null,
    client_logged_at: s.clientLoggedAt ?? new Date().toISOString(),
  }));
  const { error } = await db()
    .from('t4m_logged_set')
    .upsert(rows, { onConflict: 'session_id,block_letter,slot,set_number' });
  if (error) throw new Error(error.message);
}

export async function getLoggedSets(sessionId: string) {
  const { data, error } = await db()
    .from('t4m_logged_set').select('*').eq('session_id', sessionId).order('created_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLogsForProgram(programId: string) {
  const { data, error } = await db()
    .from('t4m_logged_set')
    .select('*, t4m_session!inner(program_id, week_number)')
    .eq('t4m_session.program_id', programId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function historyForExercise(exerciseId: string) {
  const { data, error } = await db()
    .from('t4m_logged_set').select('*').eq('exercise_id', exerciseId).eq('skipped', false)
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function recentSessions(limit = 40): Promise<SessionRow[]> {
  const { data, error } = await db()
    .from('t4m_session').select('*').in('status', ['completed', 'skipped'])
    .order('scheduled_date', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSession);
}

export async function addPainFlag(area: PainArea, days = 14): Promise<void> {
  const until = new Date();
  until.setDate(until.getDate() + days);
  const { error } = await db()
    .from('t4m_pain_flag').insert({ area, active_until: until.toISOString().slice(0, 10) });
  if (error) throw new Error(error.message);
}

export async function activePainFlags(): Promise<PainArea[]> {
  const { data, error } = await db()
    .from('t4m_pain_flag').select('area')
    .gte('active_until', new Date().toISOString().slice(0, 10));
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.area as PainArea))];
}

export async function listPRs() {
  const { data, error } = await db()
    .from('t4m_pr').select('*').order('achieved_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function insertPRs(
  rows: { exerciseId: string; kind: string; value: number; reps?: number; weightKg?: number; sessionId: string }[],
) {
  if (rows.length === 0) return;
  const { error } = await db().from('t4m_pr').insert(
    rows.map((r) => ({
      exercise_id: r.exerciseId, kind: r.kind, value: r.value,
      reps: r.reps ?? null, weight_kg: r.weightKg ?? null, session_id: r.sessionId,
    })),
  );
  if (error) throw new Error(error.message);
}
