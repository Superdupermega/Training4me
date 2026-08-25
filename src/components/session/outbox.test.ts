import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoggedSetRow } from '@/server/repo';

/**
 * A fake idb-keyval store, deliberately shaped to distinguish a correct
 * implementation from the bug it replaces:
 *
 * - `get`/`set`/`del` each yield a real microtask before touching the store,
 *   so two calls fired without awaiting between them can genuinely
 *   interleave — exactly what let two concurrent `enqueue`s lose a write
 *   under the old get-then-set implementation (#6).
 * - `update` processes its callback through a strictly ordered chain, the
 *   same guarantee a real IndexedDB transaction gives two `update()` calls
 *   against the same key. outbox.ts relies on this for both its atomicity
 *   (#6) and its per-row `seq` stamping (#5) — a version of outbox.ts that
 *   went back to raw get/set here would fail the tests below.
 */
let store: Record<string, unknown> = {};
let chain = Promise.resolve();

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => {
    await Promise.resolve();
    return store[k];
  }),
  set: vi.fn(async (k: string, v: unknown) => {
    await Promise.resolve();
    store[k] = v;
  }),
  del: vi.fn(async (k: string) => {
    await Promise.resolve();
    delete store[k];
  }),
  update: vi.fn((k: string, updater: (old: unknown) => unknown) => {
    chain = chain.then(async () => {
      store[k] = updater(store[k]);
    });
    return chain;
  }),
}));

const { drain, enqueue, peek } = await import('./outbox');

function row(overrides: Partial<LoggedSetRow> = {}): LoggedSetRow {
  return {
    sessionId: 's1', blockLetter: 'A', slot: 'A1', exerciseId: 'back-squat',
    setNumber: 1, reps: 5, weightKg: 100, rpe: 8, skipped: false, painFlag: null,
    ...overrides,
  };
}

beforeEach(() => {
  store = {};
  chain = Promise.resolve();
});

describe('outbox', () => {
  it('stamps each enqueued row with a unique, increasing seq', async () => {
    await enqueue(row({ setNumber: 1 }));
    await enqueue(row({ setNumber: 2 }));
    const queue = await peek();
    expect(queue.map((r) => r.seq)).toEqual([1, 2]);
  });

  it('does not lose a set logged while another is enqueuing at the same time (#6)', async () => {
    await Promise.all([
      enqueue(row({ setNumber: 1 })),
      enqueue(row({ setNumber: 2 })),
    ]);
    const queue = await peek();
    expect(queue).toHaveLength(2);
    expect(queue.map((r) => r.setNumber).sort()).toEqual([1, 2]);
  });

  it('keeps a correction made while its old value is mid-flush, instead of deleting it unsent (#5)', async () => {
    await enqueue(row({ setNumber: 1, weightKg: 100 }));

    let releaseSend!: () => void;
    const sendGate = new Promise<void>((resolve) => { releaseSend = resolve; });

    const drainPromise = drain(async (rows) => {
      // Simulate the send being in flight while the user corrects the set
      // they just logged — re-enqueuing under the same
      // (session, block, slot, set) key before this batch's send resolves.
      await enqueue(row({ setNumber: 1, weightKg: 105 }));
      await sendGate;
      return { ok: true };
    });

    // Let the enqueue-during-send actually happen before releasing the send.
    await Promise.resolve();
    await Promise.resolve();
    releaseSend();
    await drainPromise;

    const remaining = await peek();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.weightKg).toBe(105);
  });

  it('clears the queue once every sent row is confirmed', async () => {
    await enqueue(row({ setNumber: 1 }));
    await enqueue(row({ setNumber: 2 }));
    const remaining = await drain(async () => ({ ok: true }));
    expect(remaining).toBe(0);
    expect(await peek()).toHaveLength(0);
  });

  it('leaves the queue untouched when the send fails', async () => {
    await enqueue(row({ setNumber: 1 }));
    const remaining = await drain(async () => ({ ok: false }));
    expect(remaining).toBe(1);
    expect(await peek()).toHaveLength(1);
  });
});
