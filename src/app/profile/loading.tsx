import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';

export default function Loading() {
  return (
    <AppShell title="Profile">
      <PageContainer width="wide" grid={false}>
        <Stack spacing={2.5}>
          <Box>
            <Skeleton variant="text" width="40%" height={40} />
            <Skeleton variant="rounded" width={140} height={28} sx={{ mt: 1, borderRadius: 999 }} />
          </Box>
          <Skeleton variant="rounded" height={72} sx={{ borderRadius: 4 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <Box key={i}>
                <Skeleton variant="text" width="40%" height={18} />
                <Card variant="outlined" sx={{ mt: 1, p: 2 }}>
                  <Stack spacing={1}>
                    {Array.from({ length: 3 }).map((__, j) => (
                      <Skeleton key={j} variant="text" height={22} />
                    ))}
                  </Stack>
                </Card>
              </Box>
            ))}
          </Box>
          <Skeleton variant="rounded" height={88} sx={{ borderRadius: 4 }} />
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
