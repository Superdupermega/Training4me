import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { SettingsSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <AppShell title="Settings" backHref="/profile">
      <PageContainer>
        <SettingsSkeleton />
      </PageContainer>
    </AppShell>
  );
}
