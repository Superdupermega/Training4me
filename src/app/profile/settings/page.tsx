import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { SettingsForm } from './SettingsForm';
import { getProfile, getTrainingMaxes } from '@/server/repo';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [profile, trainingMaxes] = await Promise.all([getProfile(), getTrainingMaxes()]);
  return (
    <AppShell title="Settings" backHref="/profile">
      <PageContainer>
        <SettingsForm profile={profile} trainingMaxes={trainingMaxes} />
      </PageContainer>
    </AppShell>
  );
}
