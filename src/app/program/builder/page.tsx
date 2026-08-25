import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TopBar } from '@/components/nav/TopBar';
import { RoutineList } from '@/components/builder/RoutineList';
import { listRoutines } from '@/server/routines';

export const dynamic = 'force-dynamic';

/**
 * Full-screen, no bottom nav / rail: this is an action from /program, not a
 * nav destination of its own.
 */
export default async function ProgramBuilderPage() {
  const routines = await listRoutines();

  return (
    <Box sx={{ minHeight: '100dvh' }}>
      <TopBar title="Build a program" backHref="/program" />
      <Stack spacing={2} sx={{ maxWidth: 560, mx: 'auto', px: 2, py: 3 }}>
        <Typography color="text.secondary">
          Lay out your own days, pick exercises straight from the library, and set sets, reps,
          tempo and rest yourself — then train it in the same session player as a generated block.
        </Typography>
        <RoutineList routines={routines} />
      </Stack>
    </Box>
  );
}
