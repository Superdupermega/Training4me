import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { TopBar } from '@/components/nav/TopBar';

export default function Loading() {
  return (
    <Box sx={{ minHeight: '100dvh' }}>
      <TopBar title="Program" backHref="/program/builder" />
      <Stack spacing={2} sx={{ maxWidth: 680, mx: 'auto', px: 2, py: 2 }}>
        <Skeleton variant="rounded" height={40} sx={{ borderRadius: 2 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: 3 }} />
        ))}
      </Stack>
    </Box>
  );
}
