import { describe, expect, it } from 'vitest';
import { getExercise } from '../library/exercises';
import { showsSeparateWeightField, targetOptionsFor, usesReps } from './targeting';

describe('targetOptionsFor', () => {
  it('offers only the reps-based targets for a reps movement', () => {
    const options = targetOptionsFor(getExercise('bench-press'));
    expect(options).toEqual(['rpe', 'percent_tm', 'weight', 'bodyweight']);
    expect(options).not.toContain('distance');
    expect(options).not.toContain('duration');
  });

  it('defaults a loaded carry to distance, but still offers duration — it can be walked for time', () => {
    const options = targetOptionsFor(getExercise('farmer-carry'));
    expect(options[0]).toBe('distance');
    expect(options).toContain('duration');
    expect(options).not.toContain('rpe');
    expect(options).not.toContain('percent_tm');
  });

  it('offers distance/duration for a sled push too — it also covers ground', () => {
    const options = targetOptionsFor(getExercise('sled-push'));
    expect(options[0]).toBe('distance');
    expect(options).toContain('duration');
  });

  it('keeps a static hold duration-only — a dead hang has no distance', () => {
    const options = targetOptionsFor(getExercise('dead-hang'));
    expect(options).toEqual(['duration']);
  });
});

describe('usesReps', () => {
  it('is true for every reps-family target, false for duration/distance', () => {
    expect(usesReps('rpe')).toBe(true);
    expect(usesReps('percent_tm')).toBe(true);
    expect(usesReps('weight')).toBe(true);
    expect(usesReps('bodyweight')).toBe(true);
    expect(usesReps('duration')).toBe(false);
    expect(usesReps('distance')).toBe(false);
  });
});

describe('showsSeparateWeightField', () => {
  it('shows a weight field for a loaded carry measured by distance or duration', () => {
    const farmerCarry = getExercise('farmer-carry');
    expect(showsSeparateWeightField(farmerCarry, 'distance')).toBe(true);
    expect(showsSeparateWeightField(farmerCarry, 'duration')).toBe(true);
  });

  it('never fires for a reps target — "weight" already covers a fixed weight there', () => {
    const benchPress = getExercise('bench-press');
    expect(showsSeparateWeightField(benchPress, 'weight')).toBe(false);
    expect(showsSeparateWeightField(benchPress, 'rpe')).toBe(false);
  });

  it('stays off for a non-loadable distance movement', () => {
    const deadHang = getExercise('dead-hang'); // loadable: false
    expect(showsSeparateWeightField(deadHang, 'duration')).toBe(false);
  });
});
