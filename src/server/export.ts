import 'server-only';
import { getExercise } from '@/core/library/exercises';
import { db } from './db';

/**
 * Getting your own data out. There was no CSV, no JSON, no backup —
 * years of training data lived in one table inside a Supabase project
 * shared with unrelated apps, reachable only through this UI. If that
 * project were paused, the key rotated, or a bad migration landed, there
 * was no copy anywhere else. See docs/07-PRODUCTION-REVIEW.md #16.
 */

const PAGE_SIZE = 1000;

/** Every row of a table, paginated past PostgREST's default page cap. */
async function fetchAll<T>(table: string, orderBy?: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    let query = db().from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (orderBy) query = query.order(orderBy, { ascending: true });
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

interface LoggedSetExportRow {
  session_id: string;
  block_letter: string;
  slot: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: string | number | null;
  rpe: string | number | null;
  distance_m: number | null;
  duration_sec: number | null;
  skipped: boolean;
  pain_flag: string | null;
  created_at: string;
  client_logged_at: string | null;
}

interface SessionExportRow {
  id: string;
  scheduled_date: string;
  title: string;
  week_number: number;
  day_number: number;
}

const CSV_HEADER = [
  'date', 'session_title', 'week', 'day', 'block', 'slot',
  'exercise_id', 'exercise_name', 'set_number', 'reps', 'weight_kg', 'rpe',
  'distance_m', 'duration_sec', 'skipped', 'pain_flag', 'logged_at',
];

/** RFC 4180: wrap in quotes and double up any embedded quote, only when the field actually needs it. */
export function csvField(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Every logged set, joined to its session and exercise name — the one
 * export most useful to actually do something with (a spreadsheet, another
 * tool, a personal backup you can read without this app at all).
 */
export async function exportLoggedSetsCsv(): Promise<string> {
  const [sets, sessions] = await Promise.all([
    fetchAll<LoggedSetExportRow>('t4m_logged_set', 'created_at'),
    fetchAll<SessionExportRow>('t4m_session'),
  ]);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const lines = [CSV_HEADER.join(',')];
  for (const set of sets) {
    const session = sessionById.get(set.session_id);
    // Falls back to the raw id rather than failing the whole export — a set
    // logged years ago against a custom or since-renamed exercise should
    // not stop every other row from exporting.
    const exerciseName = (() => {
      try { return getExercise(set.exercise_id).name; } catch { return set.exercise_id; }
    })();
    lines.push([
      session?.scheduled_date ?? '', session?.title ?? '', session?.week_number ?? '', session?.day_number ?? '',
      set.block_letter, set.slot, set.exercise_id, exerciseName, set.set_number,
      set.reps ?? '', set.weight_kg ?? '', set.rpe ?? '',
      set.distance_m ?? '', set.duration_sec ?? '', set.skipped, set.pain_flag ?? '',
      set.client_logged_at ?? set.created_at,
    ].map(csvField).join(','));
  }
  return lines.join('\r\n');
}

/** Every t4m_ table, in full — this app's entire footprint in the shared Supabase project it lives in. */
export async function exportFullJson(): Promise<Record<string, unknown>> {
  const tables = [
    't4m_profile', 't4m_program', 't4m_session', 't4m_logged_set', 't4m_pr',
    't4m_training_max', 't4m_routine', 't4m_routine_day', 't4m_routine_item',
    't4m_custom_exercise', 't4m_pain_flag',
  ];
  const results = await Promise.all(tables.map((table) => fetchAll(table)));
  const dump: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  tables.forEach((table, i) => { dump[table] = results[i]; });
  return dump;
}
