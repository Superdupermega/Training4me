import ConstructionIcon from '@mui/icons-material/Construction';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { TopBar } from '@/components/nav/TopBar';

export const metadata = { title: 'Build a program — Training4me' };

/**
 * Stub — the routine builder lands in chunk 18
 * (docs/06-REDESIGN-PLAN.md, chunk-18-program-builder.md). Full-screen, no
 * bottom nav / rail: this is an action from /program, not a nav destination.
 */
export default function ProgramBuilderPage() {
  return (
    <Box sx={{ minHeight: '100dvh' }}>
      <TopBar title="Build a program" backHref="/program" />
      <Stack spacing={2} sx={{ maxWidth: 480, mx: 'auto', px: 3, py: 8, textAlign: 'center', alignItems: 'center' }}>
        <ConstructionIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        <Typography variant="h1">The builder is coming</Typography>
        <Typography color="text.secondary">
          Soon you will be able to lay out your own days, pick exercises straight from the
          library, and set sets, reps, tempo and rest yourself — then train it in the same
          session player as a generated block.
        </Typography>
        <Button component={Link} href="/program" size="large">Back to your program</Button>
      </Stack>
    </Box>
  );
}
