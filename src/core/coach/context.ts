/**
 * Turns already-fetched rows into a compact, factual paragraph the system
 * prompt is built from — not a database call itself
 * (`docs/11-COACH-PLATFORM.md §4`'s "no read tools" rule: the model never has
 * read access of its own, only whatever `sendCoachMessage` looked up and
 * handed it here).
 *
 * Deliberately does **not** import `Profile`/`ProgramRow`/`SessionRow`/`Pr`
 * from `@/server/repo` — `src/core` may not depend on `@/server` at all
 * (`00-CONTEXT.md §4`, enforced by `eslint.config.mjs`'s `no-restricted-imports`
 * on `src/core/**`). The narrow local shapes below are the same pattern
 * `src/core/progression/retrospective.ts` already uses: a structural subset
 * of the real row, satisfied by the real row without an import, chosen at
 * each call site by `sendCoachMessage`.
 */

import { BY_ID as EXERCISES } from '@/core/library/exercises';

export interface CoachContextProfile {
  daysPerWeek: number | null;
  mesocycleWeeks: 4 | 6;
}

export interface CoachContextProgram {
  name: string;
  weeks: number;
  daysPerWeek: number;
  /** exerciseId -> kg, the training maxes this block was generated against. */
  trainingMaxes: Record<string, number>;
}

export interface CoachContextSession {
  weekNumber: number;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
}

export interface CoachContextPr {
  exerciseId: string;
  kind: 'e1rm' | 'rep_max_3' | 'rep_max_5' | 'best_set';
  value: number;
  reps: number | null;
  weightKg: number | null;
  /** ISO timestamp — only the date portion (`YYYY-MM-DD`) is shown. */
  achievedAt: string;
}

const PR_KIND_LABEL: Record<CoachContextPr['kind'], string> = {
  e1rm: 'estimated 1RM',
  rep_max_3: '3-rep max',
  rep_max_5: '5-rep max',
  best_set: 'best set',
};

/** Display name for an exercise id, falling back to the id itself for a stale/unknown one rather than throwing. */
function exerciseName(id: string): string {
  return EXERCISES.get(id)?.name ?? id;
}

function fmtKg(kg: number): string {
  return `${Math.round(kg * 10) / 10} kg`;
}

export function buildCoachContext(input: {
  profile: CoachContextProfile;
  activeProgram: CoachContextProgram | null;
  thisWeekSessions: CoachContextSession[];
  recentPrs: CoachContextPr[];
}): string {
  const { profile, activeProgram, thisWeekSessions, recentPrs } = input;
  const lines: string[] = [];

  lines.push(
    profile.daysPerWeek != null
      ? `The athlete trains ${profile.daysPerWeek} days a week, on a ${profile.mesocycleWeeks}-week mesocycle.`
      : `The athlete has not set a days-per-week preference yet, on a ${profile.mesocycleWeeks}-week mesocycle.`,
  );

  if (activeProgram) {
    lines.push(`Current training block: "${activeProgram.name}", ${activeProgram.daysPerWeek} days/week over ${activeProgram.weeks} weeks.`);

    const weekNumber = thisWeekSessions[0]?.weekNumber ?? null;
    if (weekNumber != null) lines.push(`This is week ${weekNumber} of ${activeProgram.weeks}.`);

    if (thisWeekSessions.length > 0) {
      const completed = thisWeekSessions.filter((s) => s.status === 'completed').length;
      lines.push(`This week: ${completed} of ${thisWeekSessions.length} sessions completed so far.`);
    } else {
      lines.push('No sessions scheduled this week.');
    }

    const tmEntries = Object.entries(activeProgram.trainingMaxes)
      .sort(([a], [b]) => exerciseName(a).localeCompare(exerciseName(b)));
    lines.push(
      tmEntries.length > 0
        ? `Training maxes: ${tmEntries.map(([id, kg]) => `${exerciseName(id)} ${fmtKg(kg)}`).join(', ')}.`
        : 'No training maxes on file yet.',
    );
  } else {
    lines.push('No active training block right now.');
  }

  if (recentPrs.length > 0) {
    const items = recentPrs.map((pr) => {
      const load = pr.weightKg != null
        ? `${fmtKg(pr.weightKg)}${pr.reps ? ` x ${pr.reps}` : ''}`
        : pr.reps ? `${pr.reps} reps` : `${pr.value}`;
      return `${exerciseName(pr.exerciseId)} ${PR_KIND_LABEL[pr.kind]}: ${load} on ${pr.achievedAt.slice(0, 10)}`;
    });
    lines.push(`Recent PRs: ${items.join('; ')}.`);
  } else {
    lines.push('No PRs logged yet.');
  }

  return lines.join('\n');
}
