import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysFromToday, isoDateInTimeZone, today } from './dates';

describe('isoDateInTimeZone', () => {
  it('reads the calendar day a moment falls on in the given timezone, not UTC', () => {
    // 23:30 UTC on the 24th is already the 25th in Stockholm (UTC+1 in August... actually +2 DST).
    const moment = new Date('2026-08-24T22:30:00Z');
    expect(isoDateInTimeZone(moment, 'UTC')).toBe('2026-08-24');
    expect(isoDateInTimeZone(moment, 'Europe/Stockholm')).toBe('2026-08-25');
  });

  it('reads the previous calendar day west of Greenwich in the early morning', () => {
    const moment = new Date('2026-08-25T02:00:00Z');
    expect(isoDateInTimeZone(moment, 'UTC')).toBe('2026-08-25');
    expect(isoDateInTimeZone(moment, 'America/Los_Angeles')).toBe('2026-08-24');
  });
});

describe('today', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is wrong in UTC and right in the local timezone at the same instant', () => {
    vi.setSystemTime(new Date('2026-08-24T22:30:00Z'));
    expect(today('UTC')).toBe('2026-08-24');
    expect(today('Europe/Stockholm')).toBe('2026-08-25');
  });
});

describe('daysFromToday', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shifts by whole calendar days in the given timezone', () => {
    vi.setSystemTime(new Date('2026-08-24T22:30:00Z')); // 2026-08-25 in Stockholm
    expect(daysFromToday(0, 'Europe/Stockholm')).toBe('2026-08-25');
    expect(daysFromToday(14, 'Europe/Stockholm')).toBe('2026-09-08');
    expect(daysFromToday(-1, 'Europe/Stockholm')).toBe('2026-08-24');
  });

  it('crosses a month boundary correctly', () => {
    vi.setSystemTime(new Date('2026-08-31T10:00:00Z'));
    expect(daysFromToday(1, 'UTC')).toBe('2026-09-01');
  });
});
