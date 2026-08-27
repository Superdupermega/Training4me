import { describe, expect, it } from 'vitest';
import { clock, formatWeight, minutes } from './format';

describe('clock', () => {
  it('renders m:ss under an hour, with a zero-padded seconds field', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(9)).toBe('0:09');
    expect(clock(59)).toBe('0:59');
    expect(clock(60)).toBe('1:00');
    expect(clock(23 * 60 + 4)).toBe('23:04');
    expect(clock(59 * 60 + 59)).toBe('59:59');
  });

  it('rolls over into hours instead of counting past 60 minutes', () => {
    // The bug this exists to stop: a session left open for two hours used to
    // render "122:56" rather than "2:02:56".
    expect(clock(3600)).toBe('1:00:00');
    expect(clock(122 * 60 + 56)).toBe('2:02:56');
    expect(clock(10 * 3600 + 5 * 60 + 7)).toBe('10:05:07');
  });

  it('never renders a negative or fractional clock', () => {
    expect(clock(-30)).toBe('0:00');
    expect(clock(90.9)).toBe('1:30');
  });
});

describe('minutes', () => {
  it('rounds seconds to whole minutes', () => {
    expect(minutes(0)).toBe('0 min');
    expect(minutes(3180)).toBe('53 min');
  });
});

describe('formatWeight', () => {
  it('drops the decimal on whole numbers and keeps a half plate', () => {
    expect(formatWeight(100)).toBe('100 kg');
    expect(formatWeight(147.5)).toBe('147.5 kg');
    expect(formatWeight(1.25)).toBe('1.25 kg');
  });

  it('renders nothing for an absent weight', () => {
    expect(formatWeight(null)).toBe('');
    expect(formatWeight(undefined)).toBe('');
  });
});
