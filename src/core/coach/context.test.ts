import { describe, expect, it } from 'vitest';
import { buildCoachContext } from './context';

describe('buildCoachContext', () => {
  it('a fixed input produces every expected fact and nothing else', () => {
    const out = buildCoachContext({
      profile: { daysPerWeek: 4, mesocycleWeeks: 6 },
      activeProgram: {
        name: 'Block 3', weeks: 6, daysPerWeek: 4,
        trainingMaxes: { 'back-squat': 140, 'bench-press': 100, deadlift: 180 },
      },
      thisWeekSessions: [
        { weekNumber: 2, status: 'completed' },
        { weekNumber: 2, status: 'completed' },
        { weekNumber: 2, status: 'planned' },
        { weekNumber: 2, status: 'planned' },
      ],
      recentPrs: [
        {
          exerciseId: 'back-squat', kind: 'e1rm', value: 145, reps: 3, weightKg: 130,
          achievedAt: '2026-08-30T18:00:00.000Z',
        },
        {
          exerciseId: 'deadlift', kind: 'rep_max_5', value: 160, reps: 5, weightKg: 160,
          achievedAt: '2026-08-20T18:00:00.000Z',
        },
      ],
    });

    // Days/week and mesocycle length.
    expect(out).toContain('4 days a week');
    expect(out).toContain('6-week mesocycle');
    // Current block.
    expect(out).toContain('"Block 3"');
    expect(out).toContain('4 days/week over 6 weeks');
    expect(out).toContain('week 2 of 6');
    // Sessions completed vs. planned this week.
    expect(out).toContain('2 of 4 sessions completed');
    // Training maxes, every exercise, sorted by display name.
    expect(out).toContain('Back Squat 140 kg');
    expect(out).toContain('Bench Press 100 kg');
    expect(out).toContain('Deadlift 180 kg');
    // Recent PRs, with dates.
    expect(out).toContain('Back Squat estimated 1RM: 130 kg x 3 on 2026-08-30');
    expect(out).toContain('Deadlift 5-rep max: 160 kg x 5 on 2026-08-20');

    // No leaked placeholders.
    expect(out).not.toContain('undefined');
    expect(out).not.toContain('null');
    expect(out).not.toContain('NaN');
  });

  it('a null active program produces something coherent, no undefined leaking', () => {
    const out = buildCoachContext({
      profile: { daysPerWeek: 3, mesocycleWeeks: 4 },
      activeProgram: null,
      thisWeekSessions: [],
      recentPrs: [],
    });

    expect(out).toContain('No active training block right now.');
    expect(out).toContain('No PRs logged yet.');
    expect(out).not.toContain('undefined');
    expect(out).not.toContain('null');
    expect(out).not.toContain('NaN');
  });

  it('no days-per-week set yet reads coherently rather than "null days"', () => {
    const out = buildCoachContext({
      profile: { daysPerWeek: null, mesocycleWeeks: 4 },
      activeProgram: null,
      thisWeekSessions: [],
      recentPrs: [],
    });

    expect(out).not.toContain('undefined');
    expect(out).not.toContain('null days');
    expect(out).toContain('has not set a days-per-week preference yet');
  });

  it('an active program with no training maxes on file says so rather than showing an empty list', () => {
    const out = buildCoachContext({
      profile: { daysPerWeek: 3, mesocycleWeeks: 4 },
      activeProgram: { name: 'Block 1', weeks: 4, daysPerWeek: 3, trainingMaxes: {} },
      thisWeekSessions: [],
      recentPrs: [],
    });

    expect(out).toContain('No training maxes on file yet.');
    expect(out).toContain('No sessions scheduled this week.');
  });

  it('an unknown exercise id falls back to the id itself rather than throwing', () => {
    expect(() => buildCoachContext({
      profile: { daysPerWeek: 3, mesocycleWeeks: 4 },
      activeProgram: { name: 'Block 1', weeks: 4, daysPerWeek: 3, trainingMaxes: { 'not-a-real-exercise': 50 } },
      thisWeekSessions: [],
      recentPrs: [],
    })).not.toThrow();
  });
});
