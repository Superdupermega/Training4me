import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * One skeleton per route, each shaped like the page it stands in for — never
 * a centred spinner (docs/04-DESIGN-SYSTEM.md §4). Pages and their
 * `loading.tsx` share these so the two cannot drift apart: change a page's
 * layout, update its skeleton here, both places stay honest.
 */

function RowSkeleton({ withTrailing = true }: { withTrailing?: boolean }) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', p: 2 }}>
      <Skeleton variant="circular" width={20} height={20} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="40%" height={18} />
      </Box>
      {withTrailing && <Skeleton variant="text" width={40} height={20} />}
    </Stack>
  );
}

function HeroCardSkeleton() {
  return (
    <Card sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Skeleton variant="text" width="30%" height={18} />
        <Skeleton variant="text" width="70%" height={34} />
        <Skeleton variant="text" width="50%" height={26} />
        <Skeleton variant="rounded" height={56} sx={{ borderRadius: 999 }} />
      </Stack>
    </Card>
  );
}

export function PlanSkeleton() {
  return (
    <Stack spacing={2.5}>
      <Box>
        <Skeleton variant="text" width="35%" height={18} />
        <Skeleton variant="text" width="55%" height={36} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={52} sx={{ borderRadius: 2 }} />
        ))}
      </Box>
      <HeroCardSkeleton />
      <Box>
        <Skeleton variant="text" width="25%" height={18} />
        <Card variant="outlined" sx={{ mt: 1 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </Card>
      </Box>
    </Stack>
  );
}

export function HistorySkeleton() {
  return (
    <Stack spacing={3}>
      <Skeleton variant="text" width="30%" height={36} />
      <Box>
        <Skeleton variant="text" width="35%" height={18} />
        <Card variant="outlined" sx={{ mt: 1 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </Card>
      </Box>
      <Box>
        <Skeleton variant="text" width="25%" height={18} />
        <Card variant="outlined" sx={{ mt: 1 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </Card>
      </Box>
    </Stack>
  );
}

export function SettingsSkeleton() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="text" width="30%" height={36} />
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} variant="outlined" sx={{ p: 2 }}>
          <Skeleton variant="text" width="40%" height={18} />
          <Skeleton variant="rounded" height={44} sx={{ mt: 1, borderRadius: 999 }} />
        </Card>
      ))}
    </Stack>
  );
}

export function SessionSkeleton() {
  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', px: 2, pt: 2, pb: 12 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 0.5 }}>
        <Skeleton variant="text" width="55%" height={40} sx={{ flex: 1 }} />
        <Skeleton variant="text" width={50} height={30} />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Skeleton variant="rounded" width={90} height={24} sx={{ borderRadius: 999 }} />
        <Skeleton variant="rounded" width={70} height={24} sx={{ borderRadius: 999 }} />
      </Stack>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={64} sx={{ mb: 1.5, borderRadius: 3 }} />
      ))}
    </Box>
  );
}
