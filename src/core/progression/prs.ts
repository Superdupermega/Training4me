import { epley } from './trainingMax';

export interface SimpleSet {
  exerciseId: string;
  reps: number;
  weightKg: number;
  skipped: boolean;
  /**
   * Optional: which session this set belongs to, carried through to the
   * winning PRRecord unchanged. Detection can run over a batch that spans
   * more than one session (the offline outbox can hold sets from two
   * sessions if a device stays offline across both), so a PR needs to be
   * attributed to the set that actually set it, not assumed to share one
   * session id with the rest of the batch.
   */
  sessionId?: string;
}

export interface PRRecord {
  exerciseId: string;
  kind: 'e1rm' | 'rep_max_3' | 'rep_max_5' | 'best_set';
  value: number;
  reps?: number;
  weightKg?: number;
  sessionId?: string;
}

/**
 * A heavier triple can be a personal record for three reps without beating the
 * estimated one-rep max, so the kinds are tracked independently.
 */
export function detectPRs(
  sets: SimpleSet[],
  existing: { exerciseId: string; kind: string; value: number }[],
): PRRecord[] {
  // Max, not last-write-wins: `existing` is a full history of every PR ever
  // recorded for a given (exercise, kind), typically ordered most-recent
  // first — a plain `.set()` per row would leave whichever entry the loop
  // visits last in the map, which for a descending-by-date list is the
  // *oldest* one, understating the real bar a new set has to clear.
  const best = new Map<string, number>();
  for (const pr of existing) {
    const key = `${pr.exerciseId}:${pr.kind}`;
    best.set(key, Math.max(best.get(key) ?? 0, pr.value));
  }

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
      reps: set.reps, weightKg: set.weightKg, sessionId: set.sessionId,
    });
    if (set.reps >= 3) {
      consider({
        exerciseId: set.exerciseId, kind: 'rep_max_3', value: set.weightKg,
        reps: set.reps, weightKg: set.weightKg, sessionId: set.sessionId,
      });
    }
    if (set.reps >= 5) {
      consider({
        exerciseId: set.exerciseId, kind: 'rep_max_5', value: set.weightKg,
        reps: set.reps, weightKg: set.weightKg, sessionId: set.sessionId,
      });
    }
  }
  return [...found.values()];
}
