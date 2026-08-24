import { epley } from './trainingMax';

export interface SimpleSet {
  exerciseId: string;
  reps: number;
  weightKg: number;
  skipped: boolean;
}

export interface PRRecord {
  exerciseId: string;
  kind: 'e1rm' | 'rep_max_3' | 'rep_max_5' | 'best_set';
  value: number;
  reps?: number;
  weightKg?: number;
}

/**
 * A heavier triple can be a personal record for three reps without beating the
 * estimated one-rep max, so the kinds are tracked independently.
 */
export function detectPRs(
  sets: SimpleSet[],
  existing: { exerciseId: string; kind: string; value: number }[],
): PRRecord[] {
  const best = new Map<string, number>();
  for (const pr of existing) best.set(`${pr.exerciseId}:${pr.kind}`, pr.value);

  const found = new Map<string, PRRecord>();
  const consider = (record: PRRecord) => {
    const key = `${record.exerciseId}:${record.kind}`;
    const previous = best.get(key) ?? 0;
    const pending = found.get(key);
    if (record.value > previous && record.value > (pending?.value ?? 0)) found.set(key, record);
  };

  for (const set of sets) {
    if (set.skipped || set.weightKg <= 0 || set.reps <= 0) continue;
    consider({
      exerciseId: set.exerciseId, kind: 'e1rm',
      value: Math.round(epley(set.weightKg, set.reps) * 10) / 10,
      reps: set.reps, weightKg: set.weightKg,
    });
    if (set.reps >= 3) {
      consider({ exerciseId: set.exerciseId, kind: 'rep_max_3', value: set.weightKg, reps: set.reps, weightKg: set.weightKg });
    }
    if (set.reps >= 5) {
      consider({ exerciseId: set.exerciseId, kind: 'rep_max_5', value: set.weightKg, reps: set.reps, weightKg: set.weightKg });
    }
  }
  return [...found.values()];
}
