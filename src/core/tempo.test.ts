import { describe, expect, it } from 'vitest';
import { parseTempo, secondsPerRep } from './tempo';

describe('tempo', () => {
  it.each([
    ['20X1', 4], ['30X1', 5], ['21X1', 5], ['4010', 5], ['3030', 6], ['30A1', 7],
  ])('%s is %i seconds per rep', (tempo, seconds) => {
    expect(secondsPerRep(tempo)).toBe(seconds);
  });

  it('treats X as one second and A as a three second hold', () => {
    expect(parseTempo('30X1')).toEqual({ eccentric: 3, pauseBottom: 0, concentric: 1, pauseTop: 1 });
    expect(parseTempo('20A1').pauseTop).toBe(1);
    expect(secondsPerRep('20A1')).toBe(6);
  });

  it.each(['', '30X', '30X11', 'ZZZZ', '30-1', '3 X1'])('rejects %s', (bad) => {
    expect(() => parseTempo(bad)).toThrow();
  });
});
