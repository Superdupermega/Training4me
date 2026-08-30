'use server';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import type { RoutineDay } from '@/core/builder/types';
import { today } from '@/core/dates';
import { generateProgram } from '@/core/generator/generateProgram';
import { PROFILE_EQUIPMENT } from '@/core/library/equipment';
import { detectPRs } from '@/core/progression/prs';
import { applyReadiness } from '@/core/progression/readiness';
import type {
  Equipment, EquipmentProfile, Experience, GeneratorInput, PainArea, Readiness, SessionBlock,
} from '@/core/types';
import * as analytics from './analytics';
import { requireUnlocked } from './authGuard';
import { exerciseContext, type ExerciseContext } from './exerciseContext';
import * as push from './push';
import * as repo from './repo';
import { TAGS } from './repo';
import * as routines from './routines';
import { ROUTINE_TAG } from './routines';

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(err: unknown): Result<never> {
  const message = err instanceof Error ? err.message : 'Something went wrong';
  return { ok: false, error: message };
}

// `unlock` itself lives in `./unlockAction` — its own module, imported by
// nothing but `/unlock` — so that page's build output never lists any of
// the actions below as one of its callable workers. See authGuard.ts.

export interface OnboardingInput {
  daysPerWeek: number;
  experience: Experience;
  equipmentProfile: EquipmentProfile;
  equipment: Equipment[];
  sessionCapSec: number;
  mesocycleWeeks: 4 | 6;
  bodyweightKg: number;
  microPlates: boolean;
  trainingMaxes: Record<string, number>;
}

export async function completeOnboarding(input: OnboardingInput): Promise<Result<{ programId: string }>> {
  try {
    await requireUnlocked();
    await repo.saveProfile({
      days_per_week: input.daysPerWeek,
      experience: input.experience,
      equipment_profile: input.equipmentProfile,
      equipment: input.equipment,
      session_cap_sec: input.sessionCapSec,
      mesocycle_weeks: input.mesocycleWeeks,
      bodyweight_kg: input.bodyweightKg,
      micro_plates: input.microPlates,
      onboarded_at: new Date().toISOString(),
    });
    await repo.setTrainingMaxes(input.trainingMaxes, 'estimated_epley');
    revalidateTag(TAGS.profile);
    const programId = await buildProgram();
    return { ok: true, data: { programId } };
  } catch (err) {
    return fail(err);
  }
}

/** Generate from whatever the profile currently says and make it the active block. */
export async function buildProgram(startDate?: string): Promise<string> {
  await requireUnlocked();
  const profile = await repo.getProfile();
  const [trainingMaxes, painFlags] = await Promise.all([
    repo.getTrainingMaxes(profile.timezone), repo.activePainFlags(profile.timezone),
  ]);
  const equipment = profile.equipment.length
    ? profile.equipment
    : PROFILE_EQUIPMENT[profile.equipmentProfile as EquipmentProfile];

  const generatorInput: GeneratorInput = {
    daysPerWeek: (profile.daysPerWeek ?? 3) as 2 | 3 | 4 | 5 | 6,
    experience: profile.experience,
    equipment,
    sessionCapSec: profile.sessionCapSec,
    mesocycleWeeks: profile.mesocycleWeeks,
    trainingMaxes,
    preferredWeekdays: profile.preferredWeekdays,
    allowAdvanced: profile.allowAdvanced,
    painFlags,
    microPlates: profile.microPlates,
    bodyweightKg: profile.bodyweightKg,
    paceFactor: profile.paceFactor,
    startDate: startDate ?? today(profile.timezone),
    seed: Math.floor(Math.random() * 1_000_000),
  };
  const program = generateProgram(generatorInput);
  const programId = await repo.persistProgram(program);
  // Every caller of buildProgram replaces the active program and its
  // sessions, so tag both here once rather than at each call site.
  revalidateTag(TAGS.program);
  revalidateTag(TAGS.sessions);
  return programId;
}

export async function regenerateProgram(): Promise<Result> {
  try {
    await requireUnlocked();
    await buildProgram();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function beginSession(sessionId: string, readiness: Readiness | null): Promise<Result> {
  try {
    await requireUnlocked();
    const [session, profile] = await Promise.all([repo.getSession(sessionId), repo.getProfile()]);
    if (!session) return { ok: false, error: 'Session not found' };

    const patch: Record<string, unknown> = { status: 'in_progress', started_at: new Date().toISOString() };
    if (readiness) {
      const planned = {
        weekNumber: session.weekNumber, dayNumber: session.dayNumber, weekday: session.weekday,
        date: session.scheduledDate, archetype: session.archetype as never, title: session.title,
        mainPattern: session.mainPattern as never, isDeload: session.isDeload,
        blocks: session.blocks, estimatedSec: session.estimatedSec, trimLog: [],
      };
      const { session: adjusted } = applyReadiness(planned, readiness, profile.sessionCapSec, profile.paceFactor);
      patch.readiness_sleep = readiness.sleep;
      patch.readiness_soreness = readiness.soreness;
      patch.readiness_stress = readiness.stress;
      patch.blocks = adjusted.blocks;
      patch.estimated_sec = adjusted.estimatedSec;
    }
    await repo.updateSession(sessionId, patch);
    revalidateTag(TAGS.sessions);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function logSets(sets: repo.LoggedSetRow[]): Promise<Result> {
  try {
    await requireUnlocked();
    await repo.logSets(sets);
    revalidateTag(TAGS.logs);
    const pain = sets.find((s) => s.painFlag);
    if (pain?.painFlag) {
      const profile = await repo.getProfile();
      await repo.addPainFlag(pain.painFlag as PainArea, profile.timezone);
      revalidateTag(TAGS.profile);
    }
    await detectAndRecordPRs(sets);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Runs PR detection against exactly the sets in this one batch, whether they
 * were logged live or arrived later out of the offline outbox — incremental
 * and order-independent, rather than the one-shot pass `finishSession` used
 * to run against whatever was already in the database at that instant. A set
 * still queued client-side when a session was finished offline used to be
 * silently skipped for PRs forever: this function runs once, whenever that
 * set actually lands, however late. See docs/07-PRODUCTION-REVIEW.md #8.
 */
async function detectAndRecordPRs(sets: repo.LoggedSetRow[]): Promise<void> {
  if (sets.length === 0) return;
  const existing = await repo.listPRs();
  const prs = detectPRs(
    sets.map((s) => ({
      exerciseId: s.exerciseId, reps: s.reps ?? 0, weightKg: s.weightKg ?? 0,
      skipped: s.skipped ?? false, sessionId: s.sessionId,
    })),
    existing.map((p) => ({ exerciseId: p.exercise_id, kind: p.kind, value: Number(p.value) })),
  );
  if (prs.length === 0) return;
  await repo.insertPRs(prs.map((p) => ({ ...p, sessionId: p.sessionId ?? sets[0]!.sessionId })));
  revalidateTag(TAGS.logs);
}

/**
 * Persists the RPE ≥ 9.5 backoff SessionPlayer applies live to future sets
 * in the block still ahead. Before this existed, the reduced weights lived
 * only in client React state (`SessionPlayer.tsx`'s `blocks`) — a reload
 * mid-session (phone died, browser evicted the tab, a check on another
 * page) brought back the original heavy prescription with the backoff
 * silently forgotten, even though the README sells this as a headline
 * adaptation. See docs/07-PRODUCTION-REVIEW.md #10.
 */
export async function applyAutoregulation(sessionId: string, blocks: SessionBlock[]): Promise<Result> {
  try {
    await requireUnlocked();
    await repo.updateSession(sessionId, { blocks, autoregulated: true });
    revalidateTag(TAGS.sessions);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function finishSession(sessionId: string, actualSec: number, notes?: string): Promise<Result> {
  try {
    await requireUnlocked();
    await repo.updateSession(sessionId, {
      status: 'completed', completed_at: new Date().toISOString(),
      actual_sec: actualSec, notes: notes ?? null,
    });
    // PR detection no longer happens here — see detectAndRecordPRs above.
    // Every set this session ever logs, including ones still queued offline
    // right now, runs through it via logSets whenever it actually arrives.
    await recalibratePace();

    revalidateTag(TAGS.sessions);
    revalidateTag(TAGS.logs);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * `t4m_session.notes` — and `finishSession`'s own optional third argument
 * above — existed since the original schema; nothing ever wrote to it after
 * the fact or read it back anywhere. This is that: editable from the
 * finished-session view (`SessionSummary.tsx`), where there is a moment to
 * write one, not mid-set where there is not. See docs/chunks/chunk-23-
 * reward-loop.md §5.
 */
export async function saveSessionNotes(sessionId: string, notes: string): Promise<Result> {
  try {
    await requireUnlocked();
    await repo.updateSession(sessionId, { notes: notes.trim() ? notes : null });
    revalidateTag(TAGS.sessions);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function skipSession(sessionId: string): Promise<Result> {
  try {
    await requireUnlocked();
    await repo.updateSession(sessionId, { status: 'skipped' });
    revalidateTag(TAGS.sessions);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** After five sessions we know how fast this athlete actually moves. */
async function recalibratePace(): Promise<void> {
  const done = (await repo.recentSessions(20)).filter((s) => s.actualSec && s.status === 'completed');
  if (done.length < 5) return;
  const ratios = done.map((s) => (s.actualSec ?? 0) / s.estimatedSec).sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)] ?? 1;
  await repo.saveProfile({ pace_factor: Math.min(1.3, Math.max(0.8, Number(median.toFixed(2)))) });
  revalidateTag(TAGS.profile);
}

export async function updateSettings(patch: Record<string, unknown>): Promise<Result> {
  try {
    await requireUnlocked();
    await repo.saveProfile(patch);
    revalidateTag(TAGS.profile);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Bodyweight was previously a single scalar set once at onboarding and never
 * revisited — for a strength app it is half of every meaningful ratio.
 * Logs today's entry (upserted, so logging again the same day corrects it
 * rather than duplicating), and keeps `t4m_profile.bodyweight_kg` — read
 * directly by load calculations elsewhere — in sync with the latest value.
 * See docs/07-PRODUCTION-REVIEW.md #19.
 */
export async function logBodyweight(kg: number): Promise<Result> {
  try {
    await requireUnlocked();
    if (!Number.isFinite(kg) || kg <= 0) return { ok: false, error: 'Enter a real bodyweight' };
    const profile = await repo.getProfile();
    await Promise.all([
      repo.logBodyweight(kg, today(profile.timezone)),
      repo.saveProfile({ bodyweight_kg: kg }),
    ]);
    revalidateTag(TAGS.bodyweight);
    revalidateTag(TAGS.profile);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function startNextBlock(): Promise<Result<{ completedProgramId: string } | undefined>> {
  try {
    await requireUnlocked();
    // Captured before `buildProgram()` below replaces it — this is the block
    // that just finished, not the one about to exist.
    const completed = await repo.getActiveProgram();
    const { rollOverTrainingMaxes } = await import('./nextBlock');
    const changes = await rollOverTrainingMaxes();
    // Previously this was `await rollOverTrainingMaxes();` — the return
    // value discarded outright, so the retrospective had nowhere to read
    // what moved and why. See docs/chunks/chunk-23-reward-loop.md §1.
    if (completed) {
      await repo.saveTmChanges(completed.id, changes);
      revalidateTag(TAGS.program);
    }
    revalidateTag(TAGS.profile);
    await buildProgram();
    return { ok: true, data: completed ? { completedProgramId: completed.id } : undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function goToPlan(): Promise<never> {
  redirect('/today');
}

/** Clears the active program (history stays) so the athlete is back at "no plan yet". */
export async function deleteActiveProgram(): Promise<Result> {
  try {
    await requireUnlocked();
    await repo.abandonActiveProgram();
    revalidateTag(TAGS.program);
    revalidateTag(TAGS.sessions);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------- routine builder (chunk 18)

export async function createRoutine(input: routines.CreateRoutineInput): Promise<Result<{ routineId: string }>> {
  try {
    await requireUnlocked();
    const routineId = await routines.createRoutine(input);
    revalidateTag(ROUTINE_TAG);
    return { ok: true, data: { routineId } };
  } catch (err) {
    return fail(err);
  }
}

export async function renameRoutine(routineId: string, name: string): Promise<Result> {
  try {
    await requireUnlocked();
    await routines.renameRoutine(routineId, name);
    revalidateTag(ROUTINE_TAG);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function archiveRoutine(routineId: string): Promise<Result> {
  try {
    await requireUnlocked();
    await routines.archiveRoutine(routineId);
    revalidateTag(ROUTINE_TAG);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function saveRoutineDays(routineId: string, days: RoutineDay[]): Promise<Result> {
  try {
    await requireUnlocked();
    await routines.saveRoutineDays(routineId, days);
    revalidateTag(ROUTINE_TAG);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Materialises the routine and makes it the active program (replaces any other active one). */
export async function scheduleRoutine(routineId: string): Promise<Result<{ programId: string }>> {
  try {
    await requireUnlocked();
    const [routine, profile] = await Promise.all([routines.getRoutine(routineId), repo.getProfile()]);
    if (!routine) return { ok: false, error: 'Routine not found' };
    const trainingMaxes = await repo.getTrainingMaxes(profile.timezone);

    const programId = await routines.scheduleRoutine(routine, {
      startDate: today(profile.timezone),
      trainingMaxes,
      increment: profile.microPlates ? 1.25 : 2.5,
      paceFactor: profile.paceFactor,
    });
    revalidateTag(TAGS.program);
    revalidateTag(TAGS.sessions);
    return { ok: true, data: { programId } };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Push an edit to a routine into the block currently being trained, rather
 * than starting a new one. Everything not yet trained is rewritten;
 * everything already done, in progress or skipped is left alone — see
 * `routines.updateProgramFromRoutine`.
 *
 * `adopt` is the same operation aimed at a block that did *not* come from
 * this routine — a generated one, or one built from a different routine.
 * It is a bigger change (from here on the block is this routine's, and the
 * generator's wave over the weeks ahead is gone), so it is never implied:
 * the caller has to ask for it, from behind a confirmation.
 */
export async function updateLiveProgram(
  routineId: string, opts?: { adopt?: boolean },
): Promise<Result<routines.UpdateProgramResult>> {
  try {
    await requireUnlocked();
    const [routine, profile, program] = await Promise.all([
      routines.getRoutine(routineId), repo.getProfile(), repo.getActiveProgram(),
    ]);
    if (!routine) return { ok: false, error: 'Routine not found' };
    if (!program) return { ok: false, error: 'Nothing is being trained right now' };
    if (program.routineId !== routineId && !opts?.adopt) {
      return { ok: false, error: 'This program is not the one you are training' };
    }
    const trainingMaxes = await repo.getTrainingMaxes(profile.timezone);

    const result = await routines.updateProgramFromRoutine(program.id, routine, {
      // The block's own start date, not today: the sessions ahead keep the
      // dates they were already scheduled for.
      startDate: program.startDate,
      trainingMaxes,
      increment: profile.microPlates ? 1.25 : 2.5,
      paceFactor: profile.paceFactor,
    });
    revalidateTag(TAGS.program);
    revalidateTag(TAGS.sessions);
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

/** Seeds a new routine from the currently active generated program's week one — the fast path most people will actually use. */
export async function duplicateActiveProgramAsRoutine(name: string): Promise<Result<{ routineId: string }>> {
  try {
    await requireUnlocked();
    const program = await repo.getActiveProgram();
    if (!program) return { ok: false, error: 'No active program to duplicate' };
    const sessions = await repo.listSessions(program.id);
    const week1 = sessions.filter((s) => s.weekNumber === 1);
    if (week1.length === 0) return { ok: false, error: 'Active program has no sessions yet' };

    const routineId = await routines.createRoutine({
      name, weeks: program.weeks, daysPerWeek: program.daysPerWeek,
    });
    const days: RoutineDay[] = week1.map((session, i) => ({
      id: '', dayIndex: i + 1, name: session.title, weekday: session.weekday, notes: null,
      items: session.blocks.flatMap((block) =>
        block.exercises.map((be, itemIndex) => {
          const firstSet = be.sets.find((s) => s.kind !== 'ramp') ?? be.sets[0];
          return {
            id: '', position: itemIndex, blockLetter: block.letter, blockKind: block.kind,
            supersetGroup: block.exercises.length > 1 ? block.letter : null,
            exerciseId: be.exerciseId,
            sets: (block.rounds && block.rounds > 1) ? block.rounds : be.sets.filter((s) => s.kind !== 'ramp').length,
            repLo: firstSet?.reps ?? null, repHi: firstSet?.reps ?? null,
            tempo: be.tempo, restSec: firstSet?.restSec ?? 90,
            targetKind: firstSet?.percentTm ? ('percent_tm' as const) : ('rpe' as const),
            percentTm: firstSet?.percentTm ? firstSet.percentTm * 100 : null,
            rpe: firstSet?.rpe ?? null, weightKg: null, durationSec: firstSet?.durationSec ?? null,
            distanceM: firstSet?.distanceM ?? null, perSide: firstSet?.perSide ?? false, notes: null,
          };
        }),
      ),
    }));
    await routines.saveRoutineDays(routineId, days);
    revalidateTag(ROUTINE_TAG);
    return { ok: true, data: { routineId } };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------- exercise context (chunk 19)

/**
 * "What did I do last time, or what does my training max say to expect" —
 * batched (one call, many ids) so the exercise picker can show a line on
 * every visible row without an N+1. Read-only, but a server action rather
 * than a page-level fetch because the picker and the item editor are client
 * components that need this on demand, not at page load.
 */
export async function getExerciseContexts(
  exerciseIds: string[],
  opts?: { percentTm?: number; increment?: number },
): Promise<Result<Record<string, ExerciseContext>>> {
  try {
    await requireUnlocked();
    const data = await exerciseContext(exerciseIds, opts);
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------- analysis (chunk 20)

export async function getE1rmSeries(exerciseId: string): Promise<Result<Awaited<ReturnType<typeof analytics.e1rmSeries>>>> {
  try {
    await requireUnlocked();
    const profile = await repo.getProfile();
    const data = await analytics.e1rmSeries(exerciseId, profile.timezone);
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------- push notifications (#24)

export async function subscribeToPush(subscription: push.PushSubscriptionInput): Promise<Result> {
  try {
    await requireUnlocked();
    await push.savePushSubscription(subscription);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function unsubscribeFromPush(endpoint: string): Promise<Result> {
  try {
    await requireUnlocked();
    await push.deletePushSubscription(endpoint);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
