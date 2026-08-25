import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';

export const dynamic = 'force-static';

/**
 * Stub — the exercise browser lands in chunk 17, on top of the muscle
 * taxonomy and library expansion from chunk 16
 * (docs/06-REDESIGN-PLAN.md, chunk-16/17). It is already a nav destination
 * so the five-destination IA is real from chunk 15 onward, even before the
 * library behind it grows.
 */
export default function ExercisesPage() {
  return (
    <AppShell title="Exercises">
      <PageContainer>
        <Stack spacing={2} sx={{ py: 8, alignItems: 'center', textAlign: 'center' }}>
          <FitnessCenterIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h1">The exercise library is coming</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
            Soon you&apos;ll be able to browse every movement by muscle group, see how to do it,
            and pull up your own history and expected working load before you program it.
          </Typography>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
