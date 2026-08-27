import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';
import { HistorySkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <AppShell title="History" width="wide">
      <PageContainer width="wide">
        <HistorySkeleton />
      </PageContainer>
    </AppShell>
  );
}
