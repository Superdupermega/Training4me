import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../db', () => ({
  db: () => ({ rpc: (...args: unknown[]) => rpc(...args) }),
}));

const { checkCoachRateLimit } = await import('./rateLimit');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkCoachRateLimit', () => {
  it('calls the coach-specific RPC with no arguments (a single constant bucket, not an IP)', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await checkCoachRateLimit();
    expect(rpc).toHaveBeenCalledWith('t4m_check_coach_rate_limit');
  });

  it('allows the call when under the limit', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await checkCoachRateLimit()).toBe(true);
  });

  it('refuses the call when over the limit', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await checkCoachRateLimit()).toBe(false);
  });

  it('fails open on an RPC error — a rate-limiter outage never locks the athlete out', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    expect(await checkCoachRateLimit()).toBe(true);
  });
});
