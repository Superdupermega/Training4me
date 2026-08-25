import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { RoutineList } from '@/components/builder/RoutineList';
import { listRoutines } from '@/server/routines';

export const dynamic = 'force-dynamic';

/**
 * Reached from /program, not a nav destination of its own — hence
 * `backHref` rather than its own rail/bottom-nav entry — but it still uses
 * the full shell (chunk 15/`AppShell`) so the desktop rail stays put
 * instead of the whole page falling back to a bare, phone-width column.
 */
export default async function ProgramBuilderPage() {
  const routines = await listRoutines();

  return (
    <AppShell title="Build a program" backHref="/program">
      <PageContainer>
        <Stack spacing={2}>
          <Typography color="text.secondary">
            Lay out your own days, pick exercises straight from the library, and set sets, reps,
            tempo and rest yourself — then train it in the same session player as a generated block.
          </Typography>
          <RoutineList routines={routines} />
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
