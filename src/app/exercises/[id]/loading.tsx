import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';

export default function Loading() {
  return (
    <AppShell title="Exercise" backHref="/exercises">
      <PageContainer>
        <Stack spacing={2.5}>
          <Box>
            <Skeleton variant="text" width="60%" height={40} />
            <Skeleton variant="text" width="30%" height={22} />
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" width={80} height={24} sx={{ borderRadius: 999 }} />
              ))}
            </Box>
          </Box>
          <Skeleton variant="rounded" height={80} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rounded" height={160} sx={{ borderRadius: 3 }} />
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
