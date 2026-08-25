import { redirect } from 'next/navigation';
import { getProfile, getTrainingMaxes } from '@/server/repo';
import { OnboardingWizard } from './Wizard';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage({
  searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const profile = await getProfile();
  if (profile.onboardedAt && !edit) redirect('/today');

  const isEdit = Boolean(edit) && Boolean(profile.onboardedAt);
  const currentTrainingMaxes = isEdit ? await getTrainingMaxes() : {};

  return (
    <OnboardingWizard
      bodyweightKg={profile.bodyweightKg}
      isEdit={isEdit}
      currentTrainingMaxes={currentTrainingMaxes}
    />
  );
}
