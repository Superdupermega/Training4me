'use server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { generateProgram } from '@/core/generator/generateProgram';
import { PROFILE_EQUIPMENT } from '@/core/library/equipment';
import { detectPRs } from '@/core/progression/prs';
import { applyReadiness } from '@/core/progression/readiness';
import type { Equipment, EquipmentProfile, Experience, GeneratorInput, PainArea, Readiness } from '@/core/types';
import { COOKIE_MAX_AGE, COOKIE_NAME, deriveToken, safeEqual } from './lock';
import * as repo from './repo';

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(err: unknown): Result<never> {
  const message = err instanceof Error ? err.message : 'Something went wrong';
  return { ok: false, error: message };
}

export async function unlock(formData: FormData): Promise<Result> {
  const pin = process.env.APP_PIN;
  const given = String(formData.get('pin') ?? '');
  if (!pin || !safeEqual(await deriveToken(given), await deriveToken(pin))) {
    // Slow down casual guessing. Not a substitute for a long PIN.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: false, error: 'Wrong PIN' };
  }
  (await cookies()).set(COOKIE_NAME, await deriveToken(pin), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE, path: '/',
  });
  return { ok: true };
}

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
    const programId = await buildProgram();
    return { ok: true, data: { programId } };
  } catch (err) {
    return fail(err);
  }
}

/** Generate from whatever the profile currently says and make it the active block. */
export async function buildProgram(startDate?: string): Promise<string> {
  const [profile, trainingMaxes, painFlags] = await Promise.all([
    repo.getProfile(), repo.getTrainingMaxes(), repo.activePainFlags(),
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
    startDate: startDate ?? new Date().toISOString().slice(0, 10),
    seed: Math.floor(Math.random() * 1_000_000),
  };
  const program = generateProgram(generatorInput);
  return repo.persistProgram(program);
}

export async function regenerateProgram(): Promise<Result> {
  try {
    await buildProgram();
    revalidatePath('/plan');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function beginSession(sessionId: string, readiness: Readiness | null): Promise<Result> {
  try {
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
    revalidatePath(`/session/${sessionId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function logSets(sets: repo.LoggedSetRow[]): Promise<Result> {
  try {
    await repo.logSets(sets);
    const pain = sets.find((s) => s.painFlag);
    if (pain?.painFlag) await repo.addPainFlag(pain.painFlag as PainArea);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function finishSession(sessionId: string, actualSec: number, notes?: string): Promise<Result> {
  try {
    await repo.updateSession(sessionId, {
      status: 'completed', completed_at: new Date().toISOString(),
      actual_sec: actualSec, notes: notes ?? null,
    });

    const logged = await repo.getLoggedSets(sessionId);
    const existing = await repo.listPRs();
    const prs = detectPRs(
      logged.map((l) => ({
        exerciseId: l.exercise_id, reps: l.reps ?? 0,
        weightKg: l.weight_kg ? Number(l.weight_kg) : 0, skipped: l.skipped,
      })),
      existing.map((p) => ({ exerciseId: p.exercise_id, kind: p.kind, value: Number(p.value) })),
    );
    await repo.insertPRs(prs.map((p) => ({ ...p, sessionId })));
    await recalibratePace();

    revalidatePath('/plan');
    revalidatePath('/history');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function skipSession(sessionId: string): Promise<Result> {
  try {
    await repo.updateSession(sessionId, { status: 'skipped' });
    revalidatePath('/plan');
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
}

export async function updateSettings(patch: Record<string, unknown>): Promise<Result> {
  try {
    await repo.saveProfile(patch);
    revalidatePath('/settings');
    revalidatePath('/plan');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function startNextBlock(): Promise<Result> {
  try {
    const { rollOverTrainingMaxes } = await import('./nextBlock');
    await rollOverTrainingMaxes();
    await buildProgram();
    revalidatePath('/plan');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function goToPlan(): Promise<never> {
  redirect('/plan');
}
