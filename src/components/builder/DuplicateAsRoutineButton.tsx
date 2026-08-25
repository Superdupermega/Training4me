'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { duplicateActiveProgramAsRoutine } from '@/server/actions';

export function DuplicateAsRoutineButton({ programName }: { programName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Stack spacing={1}>
      <Button
        variant="outlined" size="large" disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await duplicateActiveProgramAsRoutine(`${programName} (edited)`);
          setPending(false);
          if (result.ok) router.push(`/program/builder/${result.data!.routineId}`);
          else setError(result.error);
        }}
      >
        {pending ? 'Copying…' : 'Edit this block as my own program'}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
