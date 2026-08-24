import { getExercise } from '@/core/library/exercises';
import type { PrescribedSet, SessionBlock } from '@/core/types';

export const minutes = (seconds: number) => `${Math.round(seconds / 60)} min`;

export function formatWeight(kg: number | undefined | null): string {
  if (kg == null) return '';
  return Number.isInteger(kg) ? `${kg} kg` : `${kg.toFixed(2).replace(/0$/, '')} kg`;
}

/** "4 × 5 @ 92.5 kg" — the line you actually read between sets. */
export function describeSets(sets: PrescribedSet[]): string {
  const working = sets.filter((s) => s.kind !== 'ramp');
  const first = working[0];
  if (!first) return '';
  if (first.durationSec) return `${working.length} × ${Math.round(first.durationSec / 60)} min`;
  if (first.distanceM) return `${working.length} × ${first.distanceM} m`;
  const reps = `${working.length} × ${first.reps}${first.perSide ? '/side' : ''}`;
  if (first.weightKg) return `${reps} @ ${formatWeight(first.weightKg)}`;
  if (first.rpe) return `${reps} @ RPE ${first.rpe}`;
  return reps;
}

export function mainLiftOf(blocks: SessionBlock[]): { name: string; summary: string } | null {
  const block = blocks.find((b) => b.kind === 'main');
  const be = block?.exercises[0];
  if (!be) return null;
  return { name: getExercise(be.exerciseId).name, summary: describeSets(be.sets) };
}

export const WEEKDAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
