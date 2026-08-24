'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { startNextBlock } from '@/server/actions';

export function NextBlockCard() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card sx={{ p: 2.5, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
      <Stack spacing={1.5}>
        <Typography variant="h1">Block finished</Typography>
        <Typography sx={{ opacity: 0.9 }}>
          Every session is done. Starting the next block reads your top sets, moves each training
          max accordingly, and builds the next few weeks.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          size="large" disabled={pending}
          sx={{ bgcolor: 'background.paper', color: 'text.primary', '&:hover': { bgcolor: 'background.paper' } }}
          onClick={async () => {
            setPending(true);
            const result = await startNextBlock();
            setPending(false);
            if (!result.ok) setError(result.error);
          }}
        >
          {pending ? 'Building…' : 'Start next block'}
        </Button>
      </Stack>
    </Card>
  );
}
