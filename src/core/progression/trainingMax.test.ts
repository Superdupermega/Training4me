import { describe, expect, it } from 'vitest';
import { epley, estimateTrainingMax, nextTrainingMax, resolveTrainingMax } from './trainingMax';

describe('training max', () => {
  it('estimates a one-rep max with Epley', () => {
    expect(epley(100, 5)).toBeCloseTo(116.67, 1);
  });

  it('takes a conservative first training max', () => {
    // 116.67 estimated 1RM -> 90% -> 5% haircut -> rounded to 2.5kg.
    expect(estimateTrainingMax(100, 5)).toBe(100);
  });

  it('derives related lifts from the anchor', () => {
    const tms = { 'back-squat': 140 };
    expect(resolveTrainingMax('front-squat', 'squat', tms)).toBe(120);
    expect(resolveTrainingMax('back-squat', 'squat', tms)).toBe(140);
    expect(resolveTrainingMax('bench-press', 'push_h', tms)).toBeUndefined();
  });

  it.each([
    ['moves well', { allRepsCompleted: true, rpe: 7.5 }, 0, 145, 'increase'],
    ['was hard', { allRepsCompleted: true, rpe: 9.0 }, 0, 142.5, 'small_increase'],
    ['was maximal', { allRepsCompleted: true, rpe: 9.5 }, 0, 140, 'hold'],
    ['missed reps', { allRepsCompleted: false, rpe: 10 }, 0, 132.5, 'reduce'],
  ])('when the top set %s', (_label, result, holds, expected, verdict) => {
    const out = nextTrainingMax(140, 'back-squat', result, holds);
    expect(out.next).toBe(expected);
    expect(out.verdict).toBe(verdict);
  });

  it('uses smaller jumps on upper body lifts', () => {
    expect(nextTrainingMax(80, 'bench-press', { allRepsCompleted: true, rpe: 7 }).changeKg).toBe(2.5);
    expect(nextTrainingMax(140, 'back-squat', { allRepsCompleted: true, rpe: 7 }).changeKg).toBe(5);
  });

  it('resets and lengthens the wave after two stalled blocks', () => {
    const out = nextTrainingMax(140, 'back-squat', { allRepsCompleted: true, rpe: 9.5 }, 1);
    expect(out.verdict).toBe('reduce');
    expect(out.forceSixWeekWave).toBe(true);
  });
});
