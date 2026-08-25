import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { RoutineEditor } from '@/components/builder/RoutineEditor';
import { getProfile, getTrainingMaxes } from '@/server/repo';
import { getRoutine } from '@/server/routines';

export const dynamic = 'force-dynamic';

export default async function RoutineBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [routine, profile] = await Promise.all([getRoutine(id), getProfile()]);
  if (!routine) notFound();
  const trainingMaxes = await getTrainingMaxes(profile.timezone);

  return (
    <AppShell title={routine.name} backHref="/program/builder">
      <PageContainer>
        <RoutineEditor
          routine={routine}
          trainingMaxes={trainingMaxes}
          increment={profile.microPlates ? 1.25 : 2.5}
          paceFactor={profile.paceFactor}
        />
      </PageContainer>
    </AppShell>
  );
}
