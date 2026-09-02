import 'server-only';
import { unstable_cache } from 'next/cache';
import { DEFAULT_TIMEZONE, isoDateInTimeZone, today } from '@/core/dates';
import { db } from '../db';
import { TAGS } from '../repo';

/**
 * `t4m_coach_message` / `t4m_coach_usage` reads and writes — same
 * conventions as `src/server/repo.ts`: named exports, `unstable_cache` with
 * tags for reads, plain `async function` for writes, domain types not raw
 * rows. Mutations here never call `revalidateTag` themselves — the same
 * split the rest of `src/server` uses — `actions.ts` does that.
 */

/**
 * Trim point for how much prior chat `sendCoachMessage` hands the model as
 * history (`docs/11-COACH-PLATFORM.md §7`: "trimming to the most recent N
 * turns... chunk 25 picks N"). 20 messages is ~10 user/assistant turns —
 * comfortably inside Haiku's 200K context for this app's short, factual
 * replies, while keeping the assembled prompt (and its cost) bounded no
 * matter how long the log has been running.
 */
export const COACH_HISTORY_LIMIT = 20;

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  kind: 'chat' | 'debrief';
  content: string;
  sessionId: string | null;
  proposal: unknown | null;
  proposalStatus: 'pending' | 'applied' | 'dismissed' | null;
  createdAt: string;
}

interface CoachMessageRecord {
  id: string;
  role: string;
  kind: string;
  content: string;
  session_id: string | null;
  proposal: unknown | null;
  proposal_status: string | null;
  created_at: string;
}

const toCoachMessage = (r: CoachMessageRecord): CoachMessage => ({
  id: r.id,
  role: r.role as CoachMessage['role'],
  kind: r.kind as CoachMessage['kind'],
  content: r.content,
  sessionId: r.session_id,
  proposal: r.proposal,
  proposalStatus: r.proposal_status as CoachMessage['proposalStatus'],
  createdAt: r.created_at,
});

export interface InsertCoachMessageInput {
  role: 'user' | 'assistant';
  kind: 'chat' | 'debrief';
  content: string;
  sessionId?: string | null;
}

export async function insertCoachMessage(msg: InsertCoachMessageInput): Promise<CoachMessage> {
  const { data, error } = await db()
    .from('t4m_coach_message')
    .insert({
      role: msg.role, kind: msg.kind, content: msg.content,
      session_id: msg.sessionId ?? null,
    })
    .select('*').single();
  if (error) throw new Error(error.message);
  return toCoachMessage(data as CoachMessageRecord);
}

/**
 * The most recent `limit` **chat** messages (debriefs, chunk 27, have their
 * own session-keyed lookup and never belong in this thread) — selected
 * newest-first so the `limit` cuts off the oldest, then returned in
 * chronological order. That one order serves both consumers as-is: `/coach`
 * renders it directly ("most recent last"), and `sendCoachMessage` hands the
 * same array to the model as conversation history with no re-sorting.
 */
export const listCoachMessages = unstable_cache(
  async (limit: number = COACH_HISTORY_LIMIT): Promise<CoachMessage[]> => {
    const { data, error } = await db()
      .from('t4m_coach_message').select('*').eq('kind', 'chat')
      .order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toCoachMessage).reverse();
  },
  ['t4m-coach-messages'],
  { tags: [TAGS.coach] },
);

export interface UsageEntry {
  kind: 'chat' | 'debrief' | 'proposal';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** One row per real Anthropic call — `anthropic.ts` inserts this after every successful response, from the response's real `usage`, never estimated. */
export async function recordUsage(entry: UsageEntry): Promise<void> {
  const { error } = await db().from('t4m_coach_usage').insert({
    kind: entry.kind, model: entry.model,
    input_tokens: entry.inputTokens, output_tokens: entry.outputTokens,
    cost_usd: entry.costUsd,
  });
  if (error) throw new Error(error.message);
}

interface UsageRow {
  created_at: string;
  cost_usd: number | string;
}

/**
 * Both cap checks need "spent since the start of the day/month, in the
 * athlete's own timezone" — not the server's UTC clock (the exact class of
 * bug `docs/07-PRODUCTION-REVIEW.md #7` fixed for session/analytics dates,
 * `src/server/analytics.ts`'s `isoWeekStart`). Rather than compute a
 * timezone-aware UTC instant to filter on in SQL, this pulls a bounded
 * recent window and buckets by each row's true local calendar day in JS —
 * the same technique `isoWeekStart` already established, reused here rather
 * than reinvented. 35 days back always covers the current month (max 31
 * days) with slack for the local-vs-UTC offset at the boundary; deliberately
 * not "since forever" so this table's size doesn't matter years from now.
 */
async function usageSinceDays(days: number): Promise<UsageRow[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data, error } = await db()
    .from('t4m_coach_usage').select('created_at, cost_usd')
    .gte('created_at', since.toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []) as UsageRow[];
}

function sumCost(rows: UsageRow[]): number {
  return rows.reduce((sum, r) => sum + Number(r.cost_usd), 0);
}

/** Never `unstable_cache`d — a cap check must see the true current spend, including a call made moments ago in the same session. */
export async function spentToday(timezone: string = DEFAULT_TIMEZONE): Promise<number> {
  const rows = await usageSinceDays(2);
  const todayStr = today(timezone);
  return sumCost(rows.filter((r) => isoDateInTimeZone(new Date(r.created_at), timezone) === todayStr));
}

export async function spentThisMonth(timezone: string = DEFAULT_TIMEZONE): Promise<number> {
  const rows = await usageSinceDays(35);
  const monthPrefix = today(timezone).slice(0, 7); // YYYY-MM
  return sumCost(rows.filter((r) => isoDateInTimeZone(new Date(r.created_at), timezone).startsWith(monthPrefix)));
}
