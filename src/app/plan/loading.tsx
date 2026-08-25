import { AppShell } from '@/components/AppShell';
import { PlanSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <AppShell>
      <PlanSkeleton />
    </AppShell>
  );
}
