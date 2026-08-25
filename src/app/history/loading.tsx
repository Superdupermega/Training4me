import { AppShell } from '@/components/AppShell';
import { HistorySkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <AppShell>
      <HistorySkeleton />
    </AppShell>
  );
}
