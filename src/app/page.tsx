import { redirect } from 'next/navigation';
import { getProfile } from '@/server/repo';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const profile = await getProfile();
  redirect(profile.onboardedAt ? '/plan' : '/onboarding');
}
