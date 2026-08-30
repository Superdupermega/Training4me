import { getExercise } from '@/core/library/exercises';
import type { PrescribedSet, SessionBlock } from '@/core/types';

export const minutes = (seconds: number) => `${Math.round(seconds / 60)} min`;

/**
 * The running session clock: `m:ss` under an hour, `h:mm:ss` past it.
 *
 * The player used to render `${Math.floor(elapsed / 60)}:${ss}` with no
 * rollover, so a session left open for two hours read "122:56" — a number
 * that looks like a bug and can't be read as a duration at a glance.
 */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const ss = String(secs).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(mins).padStart(2, '0')}:${ss}` : `${mins}:${ss}`;
}

export function formatWeight(kg: number | undefined | null): string {
  if (kg == null) return '';
  return Number.isInteger(kg) ? `${kg} kg` : `${kg.toFixed(2).replace(/0$/, '')} kg`;
}

/** "5 reps" / "30 m" / "2 min" — one set's own target, no weight. What `SetRow`'s row label and `RestTimer`'s next-set preview both show. */
export function setTargetText(set: PrescribedSet): string {
  if (set.distanceM) return `${set.distanceM} m${set.perSide ? '/side' : ''}`;
  if (set.durationSec) return `${Math.round(set.durationSec / 60)} min${set.perSide ? '/side' : ''}`;
  return `${set.reps}${set.perSide ? '/side' : ''} reps`;
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
