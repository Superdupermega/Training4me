import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TopBar } from '@/components/nav/TopBar';
import { RoutineList } from '@/components/builder/RoutineList';
import { getActiveProgram } from '@/server/repo';
import { listRoutines } from '@/server/routines';

export const dynamic = 'force-dynamic';

/**
 * Full-screen, no bottom nav / rail: this is an action from /program, not a
 * nav destination of its own.
 */
export default async function ProgramBuilderPage() {
  const [routines, activeProgram] = await Promise.all([listRoutines(), getActiveProgram()]);

  return (
    <Box sx={{ minHeight: '100dvh' }}>
      <TopBar title="Build a program" backHref="/program" />
      <Stack spacing={2} sx={{ maxWidth: 560, mx: 'auto', px: 2, py: 3 }}>
        <Typography color="text.secondary">
          Lay out your own days, pick exercises straight from the library, and set sets, reps,
          tempo and rest yourself — then train it in the same session player as a generated block.
          A program stays editable while you are training it: what you have already done keeps
          what you did, and the sessions ahead pick up the change.
        </Typography>
        <RoutineList routines={routines} liveRoutineId={activeProgram?.routineId ?? null} />
      </Stack>
    </Box>
  );
}
