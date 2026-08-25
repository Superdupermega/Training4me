import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';

export default function Loading() {
  return (
    <AppShell title="Exercises">
      <PageContainer>
        <Stack spacing={1.5}>
          <Skeleton variant="rounded" height={40} sx={{ borderRadius: 2 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" width={80} height={28} sx={{ borderRadius: 999 }} />
            ))}
          </Box>
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} sx={{ py: 1.25 }}>
                <Skeleton variant="text" width="55%" height={24} />
                <Skeleton variant="text" width="75%" height={18} />
              </Box>
            ))}
          </Box>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
