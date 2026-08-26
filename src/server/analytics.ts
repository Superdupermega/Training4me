import 'server-only';
import { unstable_cache } from 'next/cache';
import { DEFAULT_TIMEZONE, isoDateInTimeZone, today } from '@/core/dates';
import { getExercise } from '@/core/library/exercises';
import { browseGroupsFor } from '@/core/library/query';
import { GROUP_LABEL, type MuscleGroup } from '@/core/library/muscles';
import { epley } from '@/core/progression/trainingMax';
import { db } from './db';
import { TAGS } from './repo';

/**
 * The analysis queries behind `/profile` (chunk 20). Muscle-group
 * attribution happens here, in JS against the static exercise library, not
 * in SQL — `t4m_logged_set` only knows an `exercise_id`; everything about
 * what that movement trains lives in `src/core/library`, which is
 * TypeScript, not a database table (a deliberate v1 decision, `DECISIONS.md`
 * 2026-08-24). A set's volume is credited to its primary muscles only,
 * split evenly between them — secondaries are real but incidental work, and
 * an unweighted, unexplained number would be worse than a simple one.
 *
 * Simplification worth knowing: `t4m_logged_set` has no `kind` column, so a
 * ramp set (which the generator prescribes but never counts as working
 * volume) is indistinguishable from a working set without joining back to
 * the session's `blocks` JSONB by slot/set-number. These queries count every
 * non-skipped logged set — ramps included — as one set. For the weekly-
 * trend and muscle-balance headlines this analysis exists for, that is a
 * small, honest simplification, not a silent one (recorded in
 * DECISIONS.md), and it stays exactly consistent across weeks so trends are
 * still trustworthy even though the absolute count runs slightly high.
 */

interface LoggedRow {
  exercise_id: string; reps: number | null; weight_kg: string | number | null;
  created_at: string; skipped: boolean;
}

async function loggedSetsSince(days: number): Promise<LoggedRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await db()
    .from('t4m_logged_set')
    .select('exercise_id, reps, weight_kg, created_at, skipped')
    .eq('skipped', false)
    .gte('created_at', since.toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []) as LoggedRow[];
}

/**
 * Exported for its own test — the trickiest, highest-stakes bit of pure
 * logic here: get this wrong and every set in the week is silently
 * misattributed.
 *
 * `date` is a `created_at` timestamp fixed to a UTC instant. This first
 * converts it to the athlete's own local calendar day (`isoDateInTimeZone`)
 * *before* finding that week's Monday, so a set logged late on a Sunday
 * evening in Stockholm lands in the week that actually started the next
 * Monday, not the UTC-Sunday one. Previously this operated on the UTC
 * instant directly (`getDay`/`setDate`/`toISOString`), which is the same
 * class of bug as #7's eight "what date is today" call sites, just applied
 * to bucketing historical rows instead — closed here rather than folded
 * into #7 originally, since it changed this function's (and weeklyVolume's,
 * and calendarActivity's) tested contract. See docs/07-PRODUCTION-REVIEW.md #7.
 */
export function isoWeekStart(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const localDate = isoDateInTimeZone(date, timeZone);
  // Anchor at UTC noon so subtracting whole days can't itself be pushed
  // across a calendar boundary by a timezone's DST transition — same trick
  // as core/dates.ts's daysFromToday.
  const anchor = new Date(`${localDate}T12:00:00Z`);
  const day = (anchor.getUTCDay() + 6) % 7; // 0 = Monday
  anchor.setUTCDate(anchor.getUTCDate() - day);
  return isoDateInTimeZone(anchor, timeZone);
}

export interface WeekBucket {
  weekStart: string;
  label: string;
  sets: number;
  tonnageKg: number;
}

export const weeklyVolume = unstable_cache(
  async (weeks = 8, timezone: string = DEFAULT_TIMEZONE): Promise<WeekBucket[]> => {
    const rows = await loggedSetsSince(weeks * 7);
    const buckets = new Map<string, WeekBucket>();
    for (const row of rows) {
      const weekStart = isoWeekStart(new Date(row.created_at), timezone);
      const bucket = buckets.get(weekStart) ?? { weekStart, label: '', sets: 0, tonnageKg: 0 };
      bucket.sets += 1;
      bucket.tonnageKg += Number(row.weight_kg ?? 0) * (row.reps ?? 0);
      buckets.set(weekStart, bucket);
    }
    // Fill every week in the window, including ones with nothing logged —
    // a gap should read as a gap, not disappear from the axis. Anchored on
    // "today" in `timezone` at noon UTC (daysFromToday's own trick) rather
    // than the server's raw UTC `new Date()`, so this walks the athlete's
    // own weeks, not whichever week a UTC clock happens to be in.
    const out: WeekBucket[] = [];
    for (let i = weeks - 1; i >= 0; i -= 1) {
      const d = new Date(`${today(timezone)}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i * 7);
      const weekStart = isoWeekStart(d, timezone);
      const existing = buckets.get(weekStart);
      out.push({
        weekStart, label: `W${weeks - i}`,
        sets: existing?.sets ?? 0, tonnageKg: Math.round(existing?.tonnageKg ?? 0),
      });
    }
    return out;
  },
  ['t4m-weekly-volume'],
  { tags: [TAGS.logs] },
);

export interface MuscleGroupVolume {
  group: MuscleGroup;
  label: string;
  sets: number;
}

export const volumeByMuscleGroup = unstable_cache(
  async (weeks = 4): Promise<MuscleGroupVolume[]> => {
    const rows = await loggedSetsSince(weeks * 7);
    const totals = new Map<MuscleGroup, number>();
    for (const row of rows) {
      const exercise = getExercise(row.exercise_id);
      const groups = browseGroupsFor(exercise);
      if (groups.length === 0) continue;
      const share = 1 / groups.length;
      for (const g of groups) totals.set(g, (totals.get(g) ?? 0) + share);
    }
    return [...totals.entries()]
      .map(([group, sets]) => ({ group, label: GROUP_LABEL[group], sets: Math.round(sets * 10) / 10 }))
      .sort((a, b) => b.sets - a.sets);
  },
  ['t4m-volume-by-muscle-group'],
  { tags: [TAGS.logs] },
);

export interface E1rmPoint {
  date: string;
  e1rm: number;
  isPr: boolean;
}

export const e1rmSeries = unstable_cache(
  async (exerciseId: string, timezone: string = DEFAULT_TIMEZONE): Promise<E1rmPoint[]> => {
    const { data, error } = await db()
      .from('t4m_logged_set').select('reps, weight_kg, created_at')
      .eq('exercise_id', exerciseId).eq('skipped', false)
      .order('created_at', { ascending: true }).limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { reps: number | null; weight_kg: string | number | null; created_at: string }[];

    // One point per day — the best set that day, not every set. Bucketed by
    // the athlete's own local calendar day, not the UTC instant `created_at`
    // is stored as (see isoWeekStart above for the same fix on weekly
    // buckets) — a late-evening set otherwise reads a day early or late.
    const byDate = new Map<string, number>();
    for (const row of rows) {
      if (row.weight_kg == null || !row.reps) continue;
      const date = isoDateInTimeZone(new Date(row.created_at), timezone);
      const e1rm = epley(Number(row.weight_kg), row.reps);
      byDate.set(date, Math.max(byDate.get(date) ?? 0, e1rm));
    }
    let runningMax = 0;
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e1rm]) => {
        const isPr = e1rm > runningMax;
        runningMax = Math.max(runningMax, e1rm);
        return { date, e1rm: Math.round(e1rm * 10) / 10, isPr };
      });
  },
  ['t4m-e1rm-series'],
  { tags: [TAGS.logs] },
);

export interface ConsistencySummary {
  completed: number;
  skipped: number;
  total: number;
  percent: number;
  weekNumber: number;
  weeks: number;
}

export const consistency = unstable_cache(
  async (timezone?: string): Promise<ConsistencySummary | null> => {
    const { data: program, error: programError } = await db()
      .from('t4m_program').select('id, weeks').eq('status', 'active').maybeSingle();
    if (programError) throw new Error(programError.message);
    if (!program) return null;

    const { data, error } = await db()
      .from('t4m_session').select('status, week_number, scheduled_date')
      .eq('program_id', program.id).lte('scheduled_date', today(timezone));
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { status: string; week_number: number; scheduled_date: string }[];
    if (rows.length === 0) return null;

    const completed = rows.filter((r) => r.status === 'completed').length;
    const skipped = rows.filter((r) => r.status === 'skipped').length;
    const weekNumber = Math.max(...rows.map((r) => r.week_number));
    return {
      completed, skipped, total: rows.length,
      percent: Math.round((completed / rows.length) * 100),
      weekNumber, weeks: program.weeks,
    };
  },
  ['t4m-consistency'],
  { tags: [TAGS.sessions] },
);

export interface CalendarDay {
  date: string;
  value: number;
}

export const calendarActivity = unstable_cache(
  async (days = 84, timezone: string = DEFAULT_TIMEZONE): Promise<CalendarDay[]> => {
    const rows = await loggedSetsSince(days);
    const byDate = new Map<string, number>();
    for (const row of rows) {
      // Local calendar day, matching the tz-aware day grid Heatmap.tsx
      // builds from `today(timezone)` — otherwise a set logged near
      // midnight could land one column off from where the grid puts it.
      const date = isoDateInTimeZone(new Date(row.created_at), timezone);
      byDate.set(date, (byDate.get(date) ?? 0) + 1);
    }
    return [...byDate.entries()].map(([date, value]) => ({ date, value }));
  },
  ['t4m-calendar-activity'],
  { tags: [TAGS.logs] },
);
