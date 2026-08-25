import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { SessionRow } from '@/components/today/SessionRow';
import { TodayCard } from '@/components/today/TodayCard';
import { WeekStrip } from '@/components/today/WeekStrip';
import { NextBlockCard } from '@/components/today/NextBlockCard';
import { getActiveProgram, getProfile, listSessions } from '@/server/repo';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  // Independent reads, fetched together — profile and the active program
  // don't depend on each other, so there is no reason to pay for them serially.
  const [profile, program] = await Promise.all([getProfile(), getActiveProgram()]);
  if (!profile.onboardedAt) redirect('/onboarding');

  if (!program) {
    return (
      <AppShell title="Today">
        <PageContainer>
          <Stack spacing={2} sx={{ py: 6 }}>
            <Typography variant="h1">No plan yet</Typography>
            <Typography color="text.secondary">
              Answer six questions and you will have a full block, day by day — or build one
              yourself, exercise by exercise.
            </Typography>
            <Button component={Link} href="/onboarding?edit=1" size="large">Build a plan</Button>
          </Stack>
        </PageContainer>
      </AppShell>
    );
  }

  const sessions = await listSessions(program.id);
  const today = new Date().toISOString().slice(0, 10);

  const todaySession = sessions.find((s) => s.scheduledDate === today && s.status !== 'completed');
  const nextSession = sessions.find((s) => s.scheduledDate >= today && s.status === 'planned');
  const featured = todaySession ?? nextSession;
  const currentWeek = featured?.weekNumber
    ?? (sessions.length ? Math.max(...sessions.map((s) => s.weekNumber)) : 1);
  const weekSessions = sessions.filter((s) => s.weekNumber === currentWeek);
  const allDone = sessions.every((s) => s.status === 'completed' || s.status === 'skipped');

  return (
    <AppShell title="Today">
      <PageContainer>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="overline" color="text.secondary">{program.name}</Typography>
            <Typography variant="h1">Week {currentWeek} of {program.weeks}</Typography>
          </Box>

          <WeekStrip
            weeks={program.weeks}
            currentWeek={currentWeek}
            sessions={sessions.map((s) => ({ weekNumber: s.weekNumber, status: s.status, isDeload: s.isDeload }))}
          />

          {allDone ? (
            <NextBlockCard />
          ) : featured ? (
            <TodayCard session={featured} isToday={Boolean(todaySession)} />
          ) : null}

          {weekSessions.some((s) => s.isDeload) && (
            <Alert severity="info" variant="outlined">
              Deload week — lighter on purpose. Do not add weight, and finish every session
              feeling like you could have done more.
            </Alert>
          )}

          <Box>
            <Typography variant="overline" color="text.secondary">This week</Typography>
            <Card variant="outlined" sx={{ mt: 1 }}>
              {weekSessions.map((session, index) => (
                <SessionRow key={session.id} session={session} divider={index < weekSessions.length - 1} />
              ))}
            </Card>
          </Box>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
