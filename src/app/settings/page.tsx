import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppShell } from '@/components/AppShell';
import { SettingsForm } from './SettingsForm';
import { getProfile, getTrainingMaxes } from '@/server/repo';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [profile, trainingMaxes] = await Promise.all([getProfile(), getTrainingMaxes()]);
  return (
    <AppShell>
      <Stack spacing={2}>
        <Typography variant="h1">Settings</Typography>
        <SettingsForm profile={profile} trainingMaxes={trainingMaxes} />
      </Stack>
    </AppShell>
  );
}
