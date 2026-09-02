import { notFound } from 'next/navigation';
import { SessionPlayer } from '@/components/session/SessionPlayer';
import { SessionSummary } from '@/components/session/SessionSummary';
import type { LoggedValue } from '@/components/session/SetRow';
import type { PainArea } from '@/core/types';
import { isCoachConfigured } from '@/server/coach/config';
import { exerciseContext } from '@/server/exerciseContext';
import { getLoggedSets, getProfile, getSession, listPRsForSession } from '@/server/repo';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, profile] = await Promise.all([getSession(id), getProfile()]);
  if (!session) notFound();

  const increment = profile.microPlates ? 1.25 : 2.5;
  const logs = await getLoggedSets(id);
  const initialLogged: Record<string, LoggedValue> = {};
  for (const log of logs) {
    initialLogged[`${log.block_letter}:${log.slot}:${log.set_number}`] = {
      reps: log.reps ?? undefined,
      weightKg: log.weight_kg != null ? Number(log.weight_kg) : undefined,
      rpe: log.rpe != null ? Number(log.rpe) : undefined,
      distanceM: log.distance_m ?? undefined,
      durationSec: log.duration_sec ?? undefined,
      painFlag: (log.pain_flag as PainArea | null) ?? null,
    };
  }

  if (session.status === 'completed') {
    const prs = await listPRsForSession(id);
    return (
      <SessionSummary
        session={session} increment={increment} initialLogged={initialLogged} prs={prs}
        microPlates={profile.microPlates} coachConfigured={isCoachConfigured()}
      />
    );
  }

  // Only a live session needs exercise context (last time / expected) —
  // the summary above shows what actually happened, not what to expect.
  const exerciseIds = [...new Set(
    session.blocks.flatMap((b) => b.exercises.map((e) => e.exerciseId)),
  )];
  const contexts = await exerciseContext(exerciseIds);

  return (
    <SessionPlayer
      session={session}
      increment={increment}
      initialLogged={initialLogged}
      contexts={contexts}
      microPlates={profile.microPlates}
    />
  );
}
