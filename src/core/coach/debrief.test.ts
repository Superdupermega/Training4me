import { describe, expect, it } from 'vitest';
import type { SessionBlock } from '@/core/types';
import { buildDebriefContext } from './debrief';

function mainBlock(): SessionBlock {
  return {
    letter: 'A', kind: 'main', name: 'Back Squat', estimatedSec: 900,
    exercises: [
      {
        slot: 'A1', exerciseId: 'back-squat', tempo: '20X0', cue: 'Brace, sit back.',
        sets: [
          { setNumber: 1, kind: 'ramp', reps: 5, restSec: 60, estimatedSec: 40 },
          { setNumber: 2, kind: 'ramp', reps: 3, restSec: 60, estimatedSec: 40 },
          { setNumber: 3, kind: 'working', reps: 5, weightKg: 100, restSec: 150, estimatedSec: 60 },
          { setNumber: 4, kind: 'working', reps: 5, weightKg: 100, restSec: 150, estimatedSec: 60 },
          { setNumber: 5, kind: 'working', reps: 5, weightKg: 100, restSec: 150, estimatedSec: 60 },
        ],
      },
    ],
  };
}

function accessoryBlock(): SessionBlock {
  return {
    letter: 'B', kind: 'secondary', name: 'Split Squat', estimatedSec: 400,
    exercises: [
      {
        slot: 'B1', exerciseId: 'bulgarian-split-squat', tempo: '30X1', cue: 'Control the eccentric.',
        sets: [
          { setNumber: 1, kind: 'working', reps: 8, weightKg: 20, restSec: 60, estimatedSec: 45 },
          { setNumber: 2, kind: 'working', reps: 8, weightKg: 20, restSec: 60, estimatedSec: 45 },
        ],
      },
    ],
  };
}

describe('buildDebriefContext', () => {
  it('a fixed input with logged sets and PRs produces every real fact and nothing invented', () => {
    const out = buildDebriefContext({
      session: {
        title: 'Squat Day', weekNumber: 3, isDeload: false, mainPattern: 'squat',
        estimatedSec: 1300, actualSec: 1500, autoregulated: true,
        blocks: [mainBlock(), accessoryBlock()],
      },
      loggedSets: [
        // Ramp sets aren't in this list at all (never logged, or excluded by
        // the caller) — the context only needs to know about work that
        // counts against the prescription.
        { reps: 5, weightKg: 100, skipped: false },
        { reps: 5, weightKg: 100, skipped: false },
        { reps: 5, weightKg: 100, skipped: false },
        { reps: 8, weightKg: 20, skipped: false },
        { reps: null, weightKg: null, skipped: true },
      ],
      prs: [
        { exerciseId: 'back-squat', kind: 'e1rm', value: 115, reps: 5, weightKg: 100 },
      ],
      previousSessionsSamePattern: [
        { scheduledDate: '2026-08-12' },
        { scheduledDate: '2026-08-26' },
      ],
    });

    expect(out).toContain('"Squat Day"');
    expect(out).toContain('week 3');
    expect(out).not.toContain('deload');

    // 5 prescribed working sets (3 back squat + 2 split squat), 4 logged, 1 skipped.
    expect(out).toContain('4 of 5 prescribed sets were completed, 1 explicitly marked skipped');

    // Tonnage: 3*5*100 + 8*20 = 1500 + 160 = 1660 kg.
    expect(out).toContain('Total tonnage logged: 1660 kg');

    // Duration.
    expect(out).toContain('Took 25 minutes (estimated 22)');

    // Autoregulation.
    expect(out).toContain('RPE 9.5+');

    // PR.
    expect(out).toContain('Back Squat estimated 1RM: 100 kg x 5');

    // Vs. last time.
    expect(out).toContain('2 earlier ones on record, most recently 2026-08-26');

    expect(out).not.toContain('undefined');
    expect(out).not.toContain('null');
    expect(out).not.toContain('NaN');
  });

  it('a deload week with no PRs and no history produces coherent output with no PR section leaking in', () => {
    const out = buildDebriefContext({
      session: {
        title: 'Deload Squat', weekNumber: 6, isDeload: true, mainPattern: 'squat',
        estimatedSec: 1200, actualSec: null, autoregulated: false,
        blocks: [mainBlock()],
      },
      loggedSets: [
        { reps: 5, weightKg: 60, skipped: false },
        { reps: 5, weightKg: 60, skipped: false },
        { reps: 5, weightKg: 60, skipped: false },
      ],
      prs: [],
      previousSessionsSamePattern: [],
    });

    expect(out).toContain('(deload week)');
    expect(out).toContain('3 of 3 prescribed sets were completed.');
    expect(out).not.toContain('explicitly marked skipped');
    expect(out).not.toContain('PR');
    expect(out).not.toContain('RPE 9.5');
    expect(out).not.toContain('earlier');
    // No `actualSec` given — no duration line at all, never a fabricated one.
    expect(out).not.toContain('Took');
    expect(out).not.toContain('undefined');
    expect(out).not.toContain('null');
    expect(out).not.toContain('NaN');
  });

  it('zero logged sets says so plainly instead of a silently-empty tonnage line', () => {
    const out = buildDebriefContext({
      session: {
        title: 'Squat Day', weekNumber: 2, isDeload: false, mainPattern: 'squat',
        estimatedSec: 1300, actualSec: null, autoregulated: false,
        blocks: [mainBlock()],
      },
      loggedSets: [],
      prs: [],
      previousSessionsSamePattern: [],
    });

    expect(out).toContain('0 of 3 prescribed sets were completed');
    expect(out).toContain('No sets were logged at all — this session looks like it was skipped in full.');
    expect(out).not.toContain('Total tonnage logged');
  });
});
