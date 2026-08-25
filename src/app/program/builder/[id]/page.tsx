import Box from '@mui/material/Box';
import { notFound } from 'next/navigation';
import { TopBar } from '@/components/nav/TopBar';
import { RoutineEditor } from '@/components/builder/RoutineEditor';
import { getProfile, getTrainingMaxes } from '@/server/repo';
import { getRoutine } from '@/server/routines';

export const dynamic = 'force-dynamic';

export default async function RoutineBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [routine, profile, trainingMaxes] = await Promise.all([
    getRoutine(id), getProfile(), getTrainingMaxes(),
  ]);
  if (!routine) notFound();

  return (
    <Box sx={{ minHeight: '100dvh' }}>
      <TopBar title={routine.name} backHref="/program/builder" />
      <Box sx={{ maxWidth: 680, mx: 'auto', px: 2, py: 2 }}>
        <RoutineEditor
          routine={routine}
          trainingMaxes={trainingMaxes}
          increment={profile.microPlates ? 1.25 : 2.5}
          paceFactor={profile.paceFactor}
        />
      </Box>
    </Box>
  );
}
