'use client';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { unlock } from '@/server/unlockAction';

function UnlockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Box
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const result = await unlock(new FormData(event.currentTarget));
        setPending(false);
        if (result.ok) router.replace(params.get('next') || '/');
        else setError(result.error);
      }}
      sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 3 }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 320 }}>
        <Box>
          <Typography variant="h1">Training4me</Typography>
          <Typography color="text.secondary">Heavy basics, done well, in under an hour.</Typography>
        </Box>
        <TextField
          name="pin" type="password" label="Passphrase" autoFocus fullWidth
          autoComplete="current-password"
          error={Boolean(error)} helperText={error ?? ' '}
          slotProps={{ htmlInput: { 'aria-label': 'Passphrase' } }}
        />
        <Button type="submit" size="large" fullWidth disabled={pending}>
          {pending ? 'Checking…' : 'Unlock'}
        </Button>
      </Stack>
    </Box>
  );
}

export default function UnlockPage() {
  return <Suspense><UnlockForm /></Suspense>;
}
