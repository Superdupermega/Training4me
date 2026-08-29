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
import { DeleteProgramButton } from '@/components/DeleteProgramButton';
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
      <AppShell title="Program" action={addAction} width="wide">
        <PageContainer width="wide" grid={false}>
          <Stack spacing={2} sx={{ py: 6, maxWidth: 520 }}>
            <Typography variant="h1">No plan yet</Typography>
            <Typography color="text.secondary">
              Answer six questions and you will have a full block, day by day — or build one
              yourself, exercise by exercise, from the exercise library.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
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
    <AppShell title="Program" action={addAction} width="wide">
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

          <Stack spacing={1.5}>
            {/* Two comparable-weight actions — same size/variant, so they line
                up edge-to-edge stacked on mobile and sit side by side once
                there's room, rather than each hugging its own text width. */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              {/* A block materialised from a routine stays editable while you
                  train it: the editor rewrites the sessions ahead of you and
                  leaves everything already trained alone. A generated block
                  has no routine behind it, so the way in is to duplicate it
                  into one first — which is what the button beside this does. */}
              {program.routineId ? (
                <Button component={Link} href={`/program/builder/${program.routineId}`} size="large">
                  Edit this program
                </Button>
              ) : (
                <DuplicateAsRoutineButton programName={program.name} />
              )}
              <Button component={Link} href="/program/builder" variant="outlined" size="large">
                Build my own program
              </Button>
            </Stack>
            {program.routineId && (
              <Typography variant="caption" color="text.secondary">
                Editing it mid-block is fine — sessions you have already trained keep exactly
                what you did.
              </Typography>
            )}
            {/* Deliberately its own row, not a third item in the group above —
                a destructive action shouldn't share visual weight with the
                two build actions. */}
            <DeleteProgramButton programName={program.name} />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))' },
              gap: 2,
            }}
          >
            {weeks.map((week) => {
              const weekSessions = sessions.filter((s) => s.weekNumber === week);
              const isDeload = weekSessions[0]?.isDeload ?? false;
              const done = weekSessions.filter((s) => s.status === 'completed').length;
              return (
                // Grid items default to `min-width: auto`, which is
                // min-content — and a `noWrap` session title has a
                // min-content width of the whole untruncated string. The
                // track grew to fit it instead of the title ellipsising, so
                // the week cards ran 14px past the viewport on a phone and
                // the page scrolled sideways. `minWidth: 0` lets the column
                // shrink and hands the truncation back to `noWrap`.
                <Box key={week} sx={{ minWidth: 0 }}>
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
