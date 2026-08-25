import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { PlanSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <AppShell title="Today">
      <PageContainer>
        <PlanSkeleton />
      </PageContainer>
    </AppShell>
  );
}
