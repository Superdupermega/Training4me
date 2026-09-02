'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { applyTestWeekResults } from '@/server/actions';

/**
 * Shown on `/today` in place of `NextBlockCard` when the active program is
 * itself a finished test week (`docs/chunks/chunk-26-test-week.md` §5) — the
 * choice already got made when the test week started, so there is exactly
 * one button here, not a second copy of `BlockDecisionButtons`.
 */
export function TestWeekDoneCard() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card sx={{ p: 2.5, bgcolor: 'primaryContainer.main', color: 'primaryContainer.contrastText' }}>
      <Stack spacing={1.5}>
        <Typography variant="h1">Test week done</Typography>
        <Typography sx={{ opacity: 0.9 }}>
          Every training max you tested gets set from exactly what you logged — anything you
          didn&apos;t test still moves the normal, inferred way.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          size="large" disabled={pending}
          sx={{ bgcolor: 'background.paper', color: 'text.primary', '&:hover': { bgcolor: 'background.paper' }, alignSelf: 'flex-start' }}
          onClick={async () => {
            setPending(true);
            const result = await applyTestWeekResults();
            setPending(false);
            if (!result.ok) { setError(result.error); return; }
            const completedId = result.data?.completedProgramId;
            router.push(completedId ? `/program/complete?programId=${completedId}` : '/today');
          }}
        >
          {pending ? 'Applying…' : 'Apply and start next block'}
        </Button>
      </Stack>
    </Card>
  );
}
