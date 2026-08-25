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
          <Box>
            <Skeleton variant="rounded" width="60%" height={36} sx={{ mb: 2, borderRadius: 2 }} />
            <Skeleton variant="rounded" height={72} sx={{ borderRadius: 4, mb: 2 }} />
            <Card variant="outlined" sx={{ p: 2 }}>
              <Skeleton variant="rounded" height={160} sx={{ borderRadius: 2 }} />
            </Card>
          </Box>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
