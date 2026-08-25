import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { TopBar } from '@/components/nav/TopBar';

export default function Loading() {
  return (
    <Box sx={{ minHeight: '100dvh' }}>
      <TopBar title="Build a program" backHref="/program" />
      <Stack spacing={2} sx={{ maxWidth: 560, mx: 'auto', px: 2, py: 3 }}>
        <Skeleton variant="text" width="90%" height={44} />
        <Skeleton variant="rounded" height={56} sx={{ borderRadius: 999 }} />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: 4 }} />
        ))}
      </Stack>
    </Box>
  );
}
