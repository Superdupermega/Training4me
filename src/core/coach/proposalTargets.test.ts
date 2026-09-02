import { describe, expect, it } from 'vitest';
import type { SessionBlock } from '../types';
import { buildProposalTargets, type ProposableSession } from './proposalTargets';

function session(overrides: Partial<ProposableSession> = {}): ProposableSession {
  return {
    id: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
    title: 'Squat Day',
    scheduledDate: '2026-09-03',
    status: 'planned',
    blocks: [
      {
        letter: 'A', kind: 'main', name: 'Back Squat', estimatedSec: 900,
        exercises: [{
          slot: 'A', exerciseId: 'back-squat', tempo: '20X1', cue: 'Brace.',
          sets: [
            { setNumber: 1, kind: 'working', reps: 5, weightKg: 100, percentTm: 0.75, rpe: 8, restSec: 180, estimatedSec: 120 },
          ],
        }],
      },
    ] as SessionBlock[],
    ...overrides,
  };
}

describe('buildProposalTargets', () => {
  it('lists a planned session with its real ids, block/slot letters and set summary', () => {
    const out = buildProposalTargets([session()]);
    expect(out).toContain('Squat Day');
    expect(out).toContain('sessionId: a1b2c3d4-e5f6-4789-9abc-def012345678');
    expect(out).toContain('A/A (main)');
    expect(out).toContain('Back Squat');
    expect(out).toContain('exerciseId: back-squat');
    expect(out).toContain('75% TM');
    expect(out).toContain('RPE 8');
  });

  it('excludes a non-planned session entirely', () => {
    const out = buildProposalTargets([session({ status: 'completed' })]);
    expect(out).not.toContain('Squat Day');
    expect(out).toContain('No planned sessions');
  });

  it('an empty list produces a clear "nothing to target" message rather than an empty string', () => {
    const out = buildProposalTargets([]);
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain('No planned sessions');
  });

  it('lists every block/slot across multiple planned sessions', () => {
    const second = session({
      id: 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789', title: 'Bench Day', scheduledDate: '2026-09-05',
      blocks: [
        {
          letter: 'C', kind: 'secondary', name: 'Row', estimatedSec: 300,
          exercises: [{
            slot: 'C', exerciseId: 'single-arm-db-row', tempo: '30X1', cue: 'Pull to the hip.',
            sets: [{ setNumber: 1, kind: 'working', reps: 8, rpe: 7.5, restSec: 90, estimatedSec: 80 }],
          }],
        },
      ] as SessionBlock[],
    });
    const out = buildProposalTargets([session(), second]);
    expect(out).toContain('Squat Day');
    expect(out).toContain('Bench Day');
    expect(out).toContain('C/C (secondary)');
  });

  it('an unknown exercise id falls back to the id itself rather than throwing', () => {
    const withUnknown = session({
      blocks: [
        {
          letter: 'A', kind: 'main', name: 'Mystery', estimatedSec: 100,
          exercises: [{
            slot: 'A', exerciseId: 'not-a-real-exercise', tempo: '20X1', cue: '',
            sets: [{ setNumber: 1, kind: 'working', reps: 5, restSec: 90, estimatedSec: 60 }],
          }],
        },
      ] as SessionBlock[],
    });
    expect(() => buildProposalTargets([withUnknown])).not.toThrow();
    expect(buildProposalTargets([withUnknown])).toContain('not-a-real-exercise');
  });
});
