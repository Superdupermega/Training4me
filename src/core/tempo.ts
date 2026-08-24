import { DomainError } from './types';

export interface Tempo {
  eccentric: number;
  pauseBottom: number;
  concentric: number;
  pauseTop: number;
}

function digit(ch: string, tempo: string): number {
  if (ch === 'X') return 1; // as fast as possible
  if (ch === 'A') return 3; // isometric hold
  if (ch >= '0' && ch <= '9') return Number(ch);
  throw new DomainError('BAD_TEMPO', `Invalid tempo character "${ch}" in "${tempo}"`, { tempo });
}

export function parseTempo(tempo: string): Tempo {
  if (typeof tempo !== 'string' || tempo.length !== 4) {
    throw new DomainError('BAD_TEMPO', `Tempo must be 4 characters, got "${tempo}"`, { tempo });
  }
  const t = tempo.toUpperCase();
  return {
    eccentric: digit(t[0]!, tempo),
    pauseBottom: digit(t[1]!, tempo),
    concentric: digit(t[2]!, tempo),
    pauseTop: digit(t[3]!, tempo),
  };
}

export function secondsPerRep(tempo: string): number {
  const t = parseTempo(tempo);
  return t.eccentric + t.pauseBottom + t.concentric + t.pauseTop;
}
