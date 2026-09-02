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
import { today } from '@/core/dates';
import { SessionRow } from '@/components/today/SessionRow';
import { TodayCard } from '@/components/today/TodayCard';
import { WeekStrip } from '@/components/today/WeekStrip';
import { NextBlockCard } from '@/components/today/NextBlockCard';
import { TestWeekDoneCard } from '@/components/today/TestWeekDoneCard';
import { consistency } from '@/server/analytics';
import { getActiveProgram, getProfile, listSessions } from '@/server/repo';
import { testWeekMeta } from '@/server/testWeek';

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

  // `consistency()` is already `unstable_cache`'d, and its own query already
  // gates on `status = 'active'` internally — running it alongside
  // `listSessions` rather than serially after costs nothing extra.
  // docs/chunks/chunk-24-craft.md §6: the number that makes you train
  // should be on the screen you open, not buried on a profile tab.
  const [sessions, streak] = await Promise.all([
    listSessions(program.id), consistency(profile.timezone),
  ]);
  const todayDate = today(profile.timezone);

  // The oldest session that isn't done, in schedule order — never just
  // "today or later". A missed day must stay visible and actionable, not
  // fall through the gap between "today" and "next planned" and quietly
  // strand the whole block (nothing else ever completes the last session).
  const featured = sessions.find((s) => s.status === 'planned' || s.status === 'in_progress');
  const featuredStatus: 'today' | 'next' | 'overdue' | null = !featured ? null
    : featured.scheduledDate < todayDate ? 'overdue'
      : featured.scheduledDate === todayDate ? 'today'
        : 'next';
  const currentWeek = featured?.weekNumber
    ?? (sessions.length ? Math.max(...sessions.map((s) => s.weekNumber)) : 1);
  const weekSessions = sessions.filter((s) => s.weekNumber === currentWeek);
  const allDone = sessions.every((s) => s.status === 'completed' || s.status === 'skipped');
  const isTestWeek = testWeekMeta(program) != null;

  return (
    <AppShell title="Today">
      <PageContainer>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="overline" color="text.secondary">{program.name}</Typography>
            <Typography variant="h1">Week {currentWeek} of {program.weeks}</Typography>
            <Typography variant="body2" color="text.secondary" className="tnum">
              {weekSessions.filter((s) => s.status === 'completed').length}/{weekSessions.length} sessions this week
              {streak && streak.currentStreak > 0
                ? ` · ${streak.currentStreak} session${streak.currentStreak === 1 ? '' : 's'} in a row`
                : ''}
            </Typography>
          </Box>

          <WeekStrip
            weeks={program.weeks}
            currentWeek={currentWeek}
            sessions={sessions.map((s) => ({ weekNumber: s.weekNumber, status: s.status, isDeload: s.isDeload }))}
          />

          {allDone ? (
            isTestWeek ? <TestWeekDoneCard /> : <NextBlockCard programId={program.id} />
          ) : featured && featuredStatus ? (
            <TodayCard session={featured} status={featuredStatus} />
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
