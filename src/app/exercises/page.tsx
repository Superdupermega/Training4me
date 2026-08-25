import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { ExerciseBrowser } from '@/components/exercises/ExerciseBrowser';
import { PROFILE_EQUIPMENT } from '@/core/library/equipment';
import type { Equipment, EquipmentProfile } from '@/core/types';
import { getProfile } from '@/server/repo';

export const dynamic = 'force-dynamic';

export default async function ExercisesPage() {
  const profile = await getProfile();
  const myEquipment: Equipment[] = profile.equipment.length
    ? profile.equipment
    : PROFILE_EQUIPMENT[profile.equipmentProfile as EquipmentProfile];

  return (
    <AppShell title="Exercises">
      <PageContainer>
        <ExerciseBrowser myEquipment={myEquipment} />
      </PageContainer>
    </AppShell>
  );
}
