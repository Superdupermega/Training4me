import { describe, expect, it } from 'vitest';
import { deriveToken, safeEqual } from './lock';

describe('lock', () => {
  it('never stores the PIN itself in the cookie', async () => {
    const token = await deriveToken('correct horse battery staple');
    expect(token).not.toContain('horse');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for the same PIN and different for another', async () => {
    expect(await deriveToken('1234')).toBe(await deriveToken('1234'));
    expect(await deriveToken('1234')).not.toBe(await deriveToken('1235'));
  });

  it('compares without leaking length or prefix matches', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});
