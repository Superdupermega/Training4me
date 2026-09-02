import { describe, expect, it } from 'vitest';
import { capCheck } from './costCap';

describe('capCheck', () => {
  it('allows a call when both today and this month are under cap', () => {
    expect(capCheck(1, 10, 2, 20)).toEqual({ allowed: true });
  });

  it('refuses with reason "daily" once today is over the daily cap', () => {
    expect(capCheck(2.01, 5, 2, 20)).toEqual({ allowed: false, reason: 'daily' });
  });

  it('refuses with reason "monthly" once the month is over cap but today is not', () => {
    expect(capCheck(0.5, 20.01, 2, 20)).toEqual({ allowed: false, reason: 'monthly' });
  });

  it('checks daily before monthly — over both still reports "daily"', () => {
    expect(capCheck(2.01, 20.01, 2, 20)).toEqual({ allowed: false, reason: 'daily' });
  });

  it('the boundary itself is allowed — spending exactly the daily cap still allows the next call', () => {
    expect(capCheck(2, 10, 2, 20)).toEqual({ allowed: true });
  });

  it('the boundary itself is allowed — spending exactly the monthly cap still allows the next call', () => {
    expect(capCheck(0, 20, 2, 20)).toEqual({ allowed: true });
  });

  it('one cent over the daily boundary refuses', () => {
    expect(capCheck(2.0001, 0, 2, 20).allowed).toBe(false);
  });

  it('one cent over the monthly boundary refuses', () => {
    expect(capCheck(0, 20.0001, 2, 20).allowed).toBe(false);
  });
});
