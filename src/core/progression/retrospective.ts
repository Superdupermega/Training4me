// Chunk 23 (docs/chunks/chunk-23-reward-loop.md §1) — the finished-block
// summary. `rollOverTrainingMaxes()` (src/server/nextBlock.ts) already
// computes exactly what moved and why; this turns that plus the block's own
// sessions and logs into the numbers a retrospective actually shows. Pure —
// no DB, no dates read from the ambient clock, everything passed in.

export interface RetrospectiveSession {
  id: string;
  weekNumber: number;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
  isDeload: boolean;
  mainPattern: string | null;
  /** Every non-ramp prescribed set across every block, and the main lift's exercise id — both read from here. */
  blocks: {
    kind: string;
    exercises: { exerciseId: string; sets: { kind: string }[] }[];
  }[];
}

export interface RetrospectiveLoggedSet {
  sessionId: string;
  exerciseId: string;
  reps: number | null;
  weightKg: number | null;
  skipped: boolean;
}

export interface TmChange {
  exerciseId: string;
  from: number;
  to: number;
  reason: string;
}

export interface RetrospectivePr {
  exerciseId: string;
  kind: string;
  value: number;
  reps: number | null;
  weightKg: number | null;
  achievedAt: string;
  sessionId: string | null;
}

export interface PeakWeekTopSet {
  exerciseId: string;
  weightKg: number | null;
  reps: number | null;
}

export interface BlockRetrospective {
  tonnageKg: number;
  setsLogged: number;
  setsPlanned: number;
  sessionsCompleted: number;
  sessionsSkipped: number;
  sessionsTotal: number;
  /** `sessionsCompleted / sessionsTotal`, `0` for an empty block rather than `NaN`. */
  adherence: number;
  peakWeekTopSets: PeakWeekTopSet[];
  prs: RetrospectivePr[];
  tmChanges: TmChange[];
}

/**
 * `t4m_logged_set` carries no `kind` column, so a ramp set logged is
 * indistinguishable from a working set logged without joining back to the
 * session's own `blocks` — the same simplification `src/server/analytics.ts`
 * already documents and makes for volume: count every non-skipped logged
 * set. `setsPlanned` has the real prescription to work from, so it *does*
 * exclude ramp sets, matching `SessionPlayer`'s own `totals` calculation.
 */
export function buildBlockRetrospective(input: {
  sessions: RetrospectiveSession[];
  loggedSets: RetrospectiveLoggedSet[];
  prs: RetrospectivePr[];
  tmChanges: TmChange[];
}): BlockRetrospective {
  const { sessions, loggedSets, prs, tmChanges } = input;

  const setsPlanned = sessions.reduce((total, session) =>
    total + session.blocks.reduce((blockTotal, block) =>
      blockTotal + block.exercises.reduce((exTotal, ex) =>
        exTotal + ex.sets.filter((s) => s.kind !== 'ramp').length, 0), 0), 0);

  const loggedNotSkipped = loggedSets.filter((s) => !s.skipped);
  const setsLogged = loggedNotSkipped.length;
  const tonnageKg = loggedNotSkipped.reduce((total, s) =>
    total + (s.weightKg != null && s.reps != null ? s.weightKg * s.reps : 0), 0);

  const sessionsCompleted = sessions.filter((s) => s.status === 'completed').length;
  const sessionsSkipped = sessions.filter((s) => s.status === 'skipped').length;
  const sessionsTotal = sessions.length;
  const adherence = sessionsTotal > 0 ? sessionsCompleted / sessionsTotal : 0;

  // The peak week is the heaviest non-deload week — the same rule
  // `rollOverTrainingMaxes` uses (its own `program.weeks === 4 ? 3 : 5`),
  // derived here from the sessions themselves rather than needing the
  // program's week count as a second input.
  const nonDeloadWeeks = sessions.filter((s) => !s.isDeload).map((s) => s.weekNumber);
  const peakWeek = nonDeloadWeeks.length > 0 ? Math.max(...nonDeloadWeeks) : null;

  const peakWeekTopSets: PeakWeekTopSet[] = [];
  if (peakWeek != null) {
    const byExercise = new Map<string, PeakWeekTopSet>();
    for (const session of sessions) {
      if (session.weekNumber !== peakWeek || session.status !== 'completed') continue;
      const mainBlock = session.blocks.find((b) => b.kind === 'main');
      const exerciseId = mainBlock?.exercises[0]?.exerciseId;
      if (!exerciseId) continue;
      const candidates = loggedNotSkipped.filter(
        (s) => s.sessionId === session.id && s.exerciseId === exerciseId && s.weightKg != null,
      );
      if (candidates.length === 0) continue;
      const top = candidates.reduce((best, s) => (s.weightKg! > (best.weightKg ?? 0) ? s : best));
      const existing = byExercise.get(exerciseId);
      if (!existing || (top.weightKg ?? 0) > (existing.weightKg ?? 0)) {
        byExercise.set(exerciseId, { exerciseId, weightKg: top.weightKg, reps: top.reps });
      }
    }
    peakWeekTopSets.push(...byExercise.values());
  }

  const sessionIds = new Set(sessions.map((s) => s.id));
  const blockPrs = prs.filter((p) => p.sessionId != null && sessionIds.has(p.sessionId));

  return {
    tonnageKg: Math.round(tonnageKg * 10) / 10,
    setsLogged, setsPlanned, sessionsCompleted, sessionsSkipped, sessionsTotal, adherence,
    peakWeekTopSets, prs: blockPrs, tmChanges,
  };
}
