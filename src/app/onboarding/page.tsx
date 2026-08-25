import { redirect } from 'next/navigation';
import { getProfile } from '@/server/repo';
import { OnboardingWizard } from './Wizard';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage({
  searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const profile = await getProfile();
  if (profile.onboardedAt && !edit) redirect('/today');
  return <OnboardingWizard bodyweightKg={profile.bodyweightKg} />;
}
