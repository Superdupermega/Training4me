import Stack from '@mui/material/Stack';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { NotificationsCard } from '@/components/profile/NotificationsCard';
import { SettingsForm } from './SettingsForm';
import { getProfile, getTrainingMaxes } from '@/server/repo';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const profile = await getProfile();
  const trainingMaxes = await getTrainingMaxes(profile.timezone);
  return (
    <AppShell title="Settings" backHref="/profile">
      <PageContainer>
        <Stack spacing={2.5}>
          <SettingsForm profile={profile} trainingMaxes={trainingMaxes} />
          <NotificationsCard />
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
