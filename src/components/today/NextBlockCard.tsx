import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { BlockDecisionButtons } from './BlockDecisionButtons';

interface Props {
  /** The block that just finished — lets "See how it went" work before "Start next block" is ever tapped. */
  programId: string;
}

export function NextBlockCard({ programId }: Props) {
  return (
    <Card sx={{ p: 2.5, bgcolor: 'primaryContainer.main', color: 'primaryContainer.contrastText' }}>
      <Stack spacing={1.5}>
        <Typography variant="h1">Block finished</Typography>
        <Typography sx={{ opacity: 0.9 }}>
          Every session is done. Starting the next block reads your top sets, moves each training
          max accordingly, and builds the next few weeks — or test them for real first, a few
          short sessions working up to a real top single on each main lift.
        </Typography>
        <BlockDecisionButtons
          programId={programId}
          primarySx={{ bgcolor: 'background.paper', color: 'text.primary', '&:hover': { bgcolor: 'background.paper' } }}
          secondarySx={{ borderColor: 'currentColor', color: 'inherit' }}
        />
        <Button
          size="large" variant="text" component={Link}
          href={`/program/complete?programId=${programId}`}
          sx={{ color: 'inherit', alignSelf: 'flex-start' }}
        >
          See how it went
        </Button>
      </Stack>
    </Card>
  );
}
