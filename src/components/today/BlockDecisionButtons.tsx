'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import type { SxProps, Theme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { startNextBlock, startTestWeek } from '@/server/actions';

interface Props {
  /** The block that just finished — reused as the retrospective's id if `startNextBlock` returns none of its own. */
  programId: string;
  primarySx?: SxProps<Theme>;
  secondarySx?: SxProps<Theme>;
}

/**
 * The one real decision at the end of a block: roll training maxes over
 * from the inferred verdict, or spend a few short sessions testing them for
 * real first (docs/chunks/chunk-26-test-week.md). Shared by `NextBlockCard`
 * (`/today`) and `/program/complete`'s pre-decision state so the choice is
 * one implementation of these two server calls, not two.
 */
export function BlockDecisionButtons({ programId, primarySx, secondarySx }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<'next' | 'test' | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Stack spacing={1.5}>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flexWrap: 'wrap' }}>
        <Button
          size="large" disabled={pending !== null} sx={primarySx}
          onClick={async () => {
            setPending('next'); setError(null);
            const result = await startNextBlock();
            setPending(null);
            if (!result.ok) { setError(result.error); return; }
            // The retrospective is the payoff for the decision that just
            // got made — training maxes have just moved, so this is the
            // one moment the reasons for each are actually fresh.
            const completedId = result.data?.completedProgramId ?? programId;
            router.push(`/program/complete?programId=${completedId}`);
          }}
        >
          {pending === 'next' ? 'Building…' : 'Start next block'}
        </Button>
        <Button
          size="large" variant="outlined" disabled={pending !== null} sx={secondarySx}
          onClick={async () => {
            setPending('test'); setError(null);
            const result = await startTestWeek();
            setPending(null);
            if (!result.ok) { setError(result.error); return; }
            // A handful of real sessions to train, same as any other block —
            // /today picks them up the moment the tags above revalidate.
            router.push('/today');
          }}
        >
          {pending === 'test' ? 'Building…' : 'Test your maxes first'}
        </Button>
      </Stack>
    </Stack>
  );
}
