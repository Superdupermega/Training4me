'use client';
import { del, get, set, update } from 'idb-keyval';
import type { LoggedSetRow } from '@/server/repo';

const KEY = 't4m-outbox';

/**
 * Logging a set must never wait for the network. Sets go into a local queue
 * first and are flushed opportunistically; the server upsert is keyed on
 * (session, block, slot, set) so replaying the queue can never duplicate.
 */
const key = (r: LoggedSetRow) => `${r.sessionId}:${r.blockLetter}:${r.slot}:${r.setNumber}`;

/**
 * Every queued row carries a monotonic sequence number, stamped inside the
 * same atomic `update()` that writes it. Two purposes:
 *
 * - `drain`'s cleanup can tell "the exact row instance I just sent" apart
 *   from "a row that happens to share the same (session, block, slot, set)
 *   key" — without it, correcting a set (re-logging the same slot) while a
 *   drain of the old value was still in flight let the drain's cleanup
 *   delete the correction it never sent, with the chip reading 0 queued.
 *   See docs/07-PRODUCTION-REVIEW.md #5.
 * - `enqueue` runs entirely inside `update()`'s callback, which idb-keyval
 *   runs as a single IndexedDB transaction — so two sets logged close
 *   together (exactly what a superset is) can no longer interleave two
 *   separate read-modify-write cycles and lose one. See #6.
 */
export async function enqueue(row: LoggedSetRow): Promise<number> {
  let length = 0;
  await update<LoggedSetRow[]>(KEY, (queue = []) => {
    const seq = 1 + queue.reduce((max, r) => Math.max(max, r.seq ?? 0), 0);
    const next = [...queue.filter((r) => key(r) !== key(row)), { ...row, seq }];
    length = next.length;
    return next;
  });
  return length;
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

  // Remove exactly the row instances we just sent, matched by `seq` rather
  // than by key — a set revised (re-logged under the same key) after this
  // batch was read gets a fresh seq from enqueue's atomic update above, so
  // it survives this cleanup even though the old value at that key was
  // what actually got sent.
  const sentSeqs = new Set(queue.map((r) => r.seq));
  let remaining = 0;
  await update<LoggedSetRow[]>(KEY, (after = []) => {
    const kept = after.filter((r) => !sentSeqs.has(r.seq));
    remaining = kept.length;
    return kept;
  });
  if (remaining === 0) await del(KEY);
  return remaining;
}
