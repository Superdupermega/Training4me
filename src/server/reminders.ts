import 'server-only';
import { today } from '@/core/dates';
import * as repo from './repo';
import { sendPushToAll } from './push';

/**
 * The two triggers docs/07-PRODUCTION-REVIEW.md #24 asked for. Both are
 * plain checks against existing repo reads — no new query surface, just
 * "is there something today's session-day push, or tonight's stuck-session
 * nudge, should say something about." Called from the cron route
 * (src/app/api/cron/reminders/route.ts); kept here, not inline in the
 * route, so they're the same shape as everything else server-side.
 *
 * The actual matching logic is pulled out as plain predicates
 * (findDueToday / findStuckOvernight) so it's testable without a database —
 * consistent with this project's "no mocked-Supabase test harness" stance
 * (docs/DECISIONS.md, chunk 19): the DB round trip itself stays untested,
 * same as every other repo.ts function, but the part that actually decides
 * whether to send anything doesn't have to be.
 */

/** Today's planned (not yet started) session, if there is one. */
export function findDueToday(sessions: repo.SessionRow[], todayDate: string): repo.SessionRow | null {
  return sessions.find((s) => s.scheduledDate === todayDate && s.status === 'planned') ?? null;
}

/** Hours an in_progress session can sit before the overnight nudge considers it stuck. */
export const OVERNIGHT_THRESHOLD_HOURS = 6;

/** An in_progress session started more than the threshold ago, if there is one. */
export function findStuckOvernight(
  sessions: repo.SessionRow[], nowMs: number, thresholdHours = OVERNIGHT_THRESHOLD_HOURS,
): repo.SessionRow | null {
  const cutoff = nowMs - thresholdHours * 60 * 60 * 1000;
  // A real elapsed-time comparison between two instants, not a "what day is
  // it" question — plain Date math is correct here, unlike the UTC-day bugs
  // #7 fixed elsewhere.
  return sessions.find((s) => s.status === 'in_progress'
    && s.startedAt != null && new Date(s.startedAt).getTime() < cutoff) ?? null;
}

export async function checkSessionDayReminder(): Promise<{ sent: number; total: number } | null> {
  const program = await repo.getActiveProgram();
  if (!program) return null;

  const [profile, sessions] = await Promise.all([repo.getProfile(), repo.listSessions(program.id)]);
  const dueToday = findDueToday(sessions, today(profile.timezone));
  if (!dueToday) return null;

  return sendPushToAll({ title: 'Training today', body: dueToday.title, url: '/today' });
}

export async function checkOvernightNudge(): Promise<{ sent: number; total: number } | null> {
  const program = await repo.getActiveProgram();
  if (!program) return null;

  const sessions = await repo.listSessions(program.id);
  const stuck = findStuckOvernight(sessions, Date.now());
  if (!stuck) return null;

  return sendPushToAll({
    title: 'Still going?',
    body: `${stuck.title} has been open since last night — finish it or leave it, either way it won't nag again until tomorrow.`,
    url: `/session/${stuck.id}`,
  });
}
