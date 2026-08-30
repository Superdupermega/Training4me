'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { startNextBlock } from '@/server/actions';

interface Props {
  /** The block that just finished — lets "See how it went" work before "Start next block" is ever tapped. */
  programId: string;
}

export function NextBlockCard({ programId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card sx={{ p: 2.5, bgcolor: 'primaryContainer.main', color: 'primaryContainer.contrastText' }}>
      <Stack spacing={1.5}>
        <Typography variant="h1">Block finished</Typography>
        <Typography sx={{ opacity: 0.9 }}>
          Every session is done. Starting the next block reads your top sets, moves each training
          max accordingly, and builds the next few weeks.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            size="large" disabled={pending}
            sx={{ bgcolor: 'background.paper', color: 'text.primary', '&:hover': { bgcolor: 'background.paper' } }}
            onClick={async () => {
              setPending(true);
              const result = await startNextBlock();
              setPending(false);
              if (!result.ok) { setError(result.error); return; }
              // The retrospective is the payoff for the decision that just
              // got made — training maxes have just moved, so this is the
              // one moment the reasons for each are actually fresh.
              const completedId = result.data?.completedProgramId ?? programId;
              router.push(`/program/complete?programId=${completedId}`);
            }}
          >
            {pending ? 'Building…' : 'Start next block'}
          </Button>
          <Button
            size="large" variant="outlined" disabled={pending} component={Link}
            href={`/program/complete?programId=${programId}`}
            sx={{ borderColor: 'currentColor', color: 'inherit' }}
          >
            See how it went
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
