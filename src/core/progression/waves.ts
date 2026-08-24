import type { PrescribedSet } from '../types';

export interface WaveWeek {
  sets: number;
  reps: number;
  percent: number;
  rpe: number;
  restSec: number;
  isDeload: boolean;
  top?: { reps: number; percent: number; rpe: number };
}

export const WAVE_4: WaveWeek[] = [
  { sets: 4, reps: 5, percent: 0.70, rpe: 7.0, restSec: 150, isDeload: false },
  { sets: 4, reps: 5, percent: 0.75, rpe: 8.0, restSec: 180, isDeload: false },
  { sets: 5, reps: 3, percent: 0.82, rpe: 8.5, restSec: 210, isDeload: false, top: { reps: 3, percent: 0.87, rpe: 8.5 } },
  { sets: 2, reps: 5, percent: 0.60, rpe: 6.0, restSec: 120, isDeload: true },
];

export const WAVE_6: WaveWeek[] = [
  { sets: 4, reps: 6, percent: 0.68, rpe: 7.0, restSec: 150, isDeload: false },
  { sets: 4, reps: 5, percent: 0.73, rpe: 7.5, restSec: 165, isDeload: false },
  { sets: 5, reps: 4, percent: 0.78, rpe: 8.0, restSec: 180, isDeload: false },
  { sets: 4, reps: 4, percent: 0.80, rpe: 8.0, restSec: 180, isDeload: false },
  { sets: 5, reps: 3, percent: 0.85, rpe: 8.5, restSec: 210, isDeload: false, top: { reps: 3, percent: 0.88, rpe: 8.5 } },
  { sets: 2, reps: 5, percent: 0.60, rpe: 6.0, restSec: 120, isDeload: true },
];

export function waveFor(weeks: 4 | 6): WaveWeek[] {
  return weeks === 4 ? WAVE_4 : WAVE_6;
}

export function isDeloadWeek(weeks: 4 | 6, week: number): boolean {
  return waveFor(weeks)[week - 1]?.isDeload ?? false;
}

export function roundToIncrement(kg: number, increment: number): number {
  return Math.round(kg / increment) * increment;
}

export interface PrescriptionArgs {
  weeks: 4 | 6;
  week: number;
  trainingMaxKg?: number;
  increment: number;
  /** Multiplier from the daily readiness check. */
  loadMultiplier?: number;
}

/**
 * Ramp sets are prescribed and displayed but never counted as working volume.
 * Without a training max we fall back to RPE targets, which is honest rather
 * than inventing a number.
 */
export function prescriptionFor(args: PrescriptionArgs): PrescribedSet[] {
  const { weeks, week, trainingMaxKg, increment } = args;
  const wave = waveFor(weeks)[week - 1];
  if (!wave) return [];
  const multiplier = args.loadMultiplier ?? 1;
  const sets: PrescribedSet[] = [];

  const working = trainingMaxKg
    ? roundToIncrement(trainingMaxKg * wave.percent * multiplier, increment)
    : undefined;

  if (working) {
    const ramps = [0.4, 0.6, 0.8];
    ramps.forEach((fraction, i) => {
      sets.push({
        setNumber: i + 1,
        kind: 'ramp',
        reps: i === 2 ? 3 : 5,
        weightKg: Math.max(increment, roundToIncrement(working * fraction, increment)),
        restSec: 60,
        estimatedSec: 0,
      });
    });
  }

  const offset = sets.length;
  for (let i = 0; i < wave.sets; i += 1) {
    sets.push({
      setNumber: offset + i + 1,
      kind: 'working',
      reps: wave.reps,
      weightKg: working,
      percentTm: wave.percent,
      rpe: wave.rpe,
      restSec: wave.restSec,
      estimatedSec: 0,
    });
  }

  if (wave.top) {
    sets.push({
      setNumber: sets.length + 1,
      kind: 'top',
      reps: wave.top.reps,
      weightKg: trainingMaxKg
        ? roundToIncrement(trainingMaxKg * wave.top.percent * multiplier, increment)
        : undefined,
      percentTm: wave.top.percent,
      rpe: wave.top.rpe,
      restSec: wave.restSec,
      estimatedSec: 0,
    });
  }

  return sets;
}
