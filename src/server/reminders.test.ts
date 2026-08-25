import { describe, expect, it } from 'vitest';
import type { SessionRow } from './repo';
import { findDueToday, findStuckOvernight, OVERNIGHT_THRESHOLD_HOURS } from './reminders';

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 's1', programId: 'p1', weekNumber: 1, dayNumber: 1, weekday: 1,
    scheduledDate: '2026-08-25', archetype: 'upper', title: 'Upper Body',
    mainPattern: null, isDeload: false, estimatedSec: 3600, blocks: [],
    status: 'planned', startedAt: null, completedAt: null, actualSec: null,
    readiness: null, autoregulated: false, notes: null,
    ...overrides,
  };
}

describe('findDueToday', () => {
  it('finds a planned session scheduled for today', () => {
    const s = session({ scheduledDate: '2026-08-25', status: 'planned' });
    expect(findDueToday([s], '2026-08-25')).toBe(s);
  });

  it('ignores a session scheduled for another day', () => {
    const s = session({ scheduledDate: '2026-08-24', status: 'planned' });
    expect(findDueToday([s], '2026-08-25')).toBeNull();
  });

  it('ignores a session already started or finished today — only a planned one is due', () => {
    for (const status of ['in_progress', 'completed', 'skipped'] as const) {
      expect(findDueToday([session({ scheduledDate: '2026-08-25', status })], '2026-08-25')).toBeNull();
    }
  });
});

describe('findStuckOvernight', () => {
  const now = new Date('2026-08-25T08:00:00Z').getTime();

  it('finds an in_progress session started more than the threshold ago', () => {
    const startedAt = new Date(now - (OVERNIGHT_THRESHOLD_HOURS + 1) * 3600_000).toISOString();
    const s = session({ status: 'in_progress', startedAt });
    expect(findStuckOvernight([s], now)).toBe(s);
  });

  it('does not flag a session started within the threshold', () => {
    const startedAt = new Date(now - (OVERNIGHT_THRESHOLD_HOURS - 1) * 3600_000).toISOString();
    const s = session({ status: 'in_progress', startedAt });
    expect(findStuckOvernight([s], now)).toBeNull();
  });

  it('ignores a session that is not in_progress, however old', () => {
    const startedAt = new Date(now - 24 * 3600_000).toISOString();
    const s = session({ status: 'completed', startedAt });
    expect(findStuckOvernight([s], now)).toBeNull();
  });

  it('ignores an in_progress session with no startedAt', () => {
    const s = session({ status: 'in_progress', startedAt: null });
    expect(findStuckOvernight([s], now)).toBeNull();
  });
});
