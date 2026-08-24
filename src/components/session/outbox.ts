'use client';
import { del, get, set } from 'idb-keyval';
import type { LoggedSetRow } from '@/server/repo';

const KEY = 't4m-outbox';

/**
 * Logging a set must never wait for the network. Sets go into a local queue
 * first and are flushed opportunistically; the server upsert is keyed on
 * (session, block, slot, set) so replaying the queue can never duplicate.
 */
export async function enqueue(row: LoggedSetRow): Promise<number> {
  const queue = (await get<LoggedSetRow[]>(KEY)) ?? [];
  const key = (r: LoggedSetRow) => `${r.sessionId}:${r.blockLetter}:${r.slot}:${r.setNumber}`;
  const next = [...queue.filter((r) => key(r) !== key(row)), row];
  await set(KEY, next);
  return next.length;
}

export async function peek(): Promise<LoggedSetRow[]> {
  return (await get<LoggedSetRow[]>(KEY)) ?? [];
}

export async function drain(
  send: (rows: LoggedSetRow[]) => Promise<{ ok: boolean }>,
): Promise<number> {
  const queue = await peek();
  if (queue.length === 0) return 0;
  const result = await send(queue);
  if (!result.ok) return queue.length;
  // Only clear what we sent; anything logged during the flush survives.
  const after = await peek();
  const sent = new Set(queue.map((r) => `${r.blockLetter}:${r.slot}:${r.setNumber}`));
  const remaining = after.filter((r) => !sent.has(`${r.blockLetter}:${r.slot}:${r.setNumber}`));
  if (remaining.length === 0) await del(KEY);
  else await set(KEY, remaining);
  return remaining.length;
}
