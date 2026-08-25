import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SessionPlayer } from '@/components/session/SessionPlayer';
import type { LoggedValue } from '@/components/session/SetRow';
import { TopBar } from '@/components/nav/TopBar';
import type { PainArea } from '@/core/types';
import { getLoggedSets, getProfile, getSession } from '@/server/repo';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, profile] = await Promise.all([getSession(id), getProfile()]);
  if (!session) notFound();

  if (session.status === 'completed') {
    return (
      <Box sx={{ minHeight: '100dvh' }}>
        <TopBar title={session.title} backHref="/today" />
        <Stack spacing={2} sx={{ maxWidth: 680, mx: 'auto', p: 3 }}>
          <Typography color="text.secondary">
            Done on {session.completedAt?.slice(0, 10)} in {Math.round((session.actualSec ?? 0) / 60)} minutes.
          </Typography>
          <Button component={Link} href="/today">Back to today</Button>
        </Stack>
      </Box>
    );
  }

  // Only a live session needs its logged sets replayed into the player —
  // a finished one returns above without ever issuing this query.
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

  return (
    <SessionPlayer
      session={session}
      increment={profile.microPlates ? 1.25 : 2.5}
      initialLogged={initialLogged}
    />
  );
}
