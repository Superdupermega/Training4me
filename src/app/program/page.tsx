import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { DuplicateAsRoutineButton } from '@/components/builder/DuplicateAsRoutineButton';
import { SessionRow } from '@/components/today/SessionRow';
import { getActiveProgram, getProfile, listSessions } from '@/server/repo';

export const dynamic = 'force-dynamic';

export default async function ProgramPage() {
  const [profile, program] = await Promise.all([getProfile(), getActiveProgram()]);
  if (!profile.onboardedAt) redirect('/onboarding');

  const addAction = (
    <IconButton component={Link} href="/program/builder" aria-label="Build a program">
      <AddIcon />
    </IconButton>
  );

  if (!program) {
    return (
      <AppShell title="Program" action={addAction}>
        <PageContainer width="wide" grid={false}>
          <Stack spacing={2} sx={{ py: 6, maxWidth: 520 }}>
            <Typography variant="h1">No plan yet</Typography>
            <Typography color="text.secondary">
              Answer six questions and you will have a full block, day by day — or build one
              yourself, exercise by exercise, from the exercise library.
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              <Button component={Link} href="/onboarding?edit=1" size="large">Build a plan for me</Button>
              <Button component={Link} href="/program/builder" size="large" variant="outlined">
                Build my own program
              </Button>
            </Stack>
          </Stack>
        </PageContainer>
      </AppShell>
    );
  }

  const sessions = await listSessions(program.id);
  const weeks = Array.from({ length: program.weeks }, (_, i) => i + 1);

  return (
    <AppShell title="Program" action={addAction}>
      <PageContainer width="wide" grid={false}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="overline" color="text.secondary">Active block</Typography>
            <Typography variant="h1">{program.name}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip size="small" label={`${program.daysPerWeek} days / week`} />
              <Chip size="small" label={`${program.weeks} weeks`} />
            </Stack>
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            <Button component={Link} href="/program/builder" variant="outlined" size="large">
              Build my own program
            </Button>
            {!(program.input as unknown as { routineId?: string } | null)?.routineId && (
              <DuplicateAsRoutineButton programName={program.name} />
            )}
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fill, minmax(360px, 1fr))' },
              gap: 2,
            }}
          >
            {weeks.map((week) => {
              const weekSessions = sessions.filter((s) => s.weekNumber === week);
              const isDeload = weekSessions[0]?.isDeload ?? false;
              const done = weekSessions.filter((s) => s.status === 'completed').length;
              return (
                <Box key={week}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1 }}>
                    <Typography variant="overline" color="text.secondary">
                      Week {week}{isDeload ? ' · Deload' : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" className="tnum">
                      {done}/{weekSessions.length}
                    </Typography>
                  </Stack>
                  <Card variant="outlined">
                    {weekSessions.map((session, index) => (
                      <SessionRow
                        key={session.id} session={session} divider={index < weekSessions.length - 1}
                      />
                    ))}
                  </Card>
                </Box>
              );
            })}
          </Box>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
