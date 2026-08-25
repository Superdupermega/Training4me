import { AppShell } from '@/components/AppShell';
import { SettingsSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <AppShell>
      <SettingsSkeleton />
    </AppShell>
  );
}
