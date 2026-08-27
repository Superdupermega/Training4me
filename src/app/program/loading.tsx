import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';

export default function Loading() {
  return (
    <AppShell title="Program" width="wide">
      <PageContainer width="wide" grid={false}>
        <Stack spacing={2.5}>
          <Box>
            <Skeleton variant="text" width="25%" height={18} />
            <Skeleton variant="text" width="50%" height={40} />
          </Box>
          <Skeleton variant="rounded" height={56} sx={{ borderRadius: 999 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} variant="outlined" sx={{ p: 2 }}>
                <Skeleton variant="text" width="30%" height={18} />
                {Array.from({ length: 3 }).map((__, j) => (
                  <Skeleton key={j} variant="text" height={40} sx={{ mt: 1 }} />
                ))}
              </Card>
            ))}
          </Box>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
