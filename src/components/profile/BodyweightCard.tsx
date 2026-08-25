'use client';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logBodyweight } from '@/server/actions';

interface Props {
  lastKg: number | null;
  lastDate: string | null;
  today: string;
}

/**
 * Bodyweight used to be a single scalar set once at onboarding and never
 * revisited — for a strength app it's half of every meaningful ratio, and
 * "look good, move well" is the stated philosophy. This is the "prompt on
 * the profile" half of the fix; BodyTab is the chart. See
 * docs/07-PRODUCTION-REVIEW.md #19.
 */
export function BodyweightCard({ lastKg, lastDate, today }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(lastKg != null ? String(lastKg) : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loggedToday = lastDate === today;

  const submit = async () => {
    const kg = Number(value);
    if (!Number.isFinite(kg) || kg <= 0) {
      setError('Enter a real number');
      return;
    }
    setPending(true);
    setError(null);
    const result = await logBodyweight(kg);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <TextField
            label="Bodyweight (kg)" size="small" fullWidth value={value}
            onChange={(e) => setValue(e.target.value)}
            error={Boolean(error)}
            helperText={error ?? (
              loggedToday ? `Logged today: ${lastKg} kg`
                : lastDate ? `Last: ${lastKg} kg on ${lastDate}`
                  : 'Not logged yet'
            )}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Box>
        <Button onClick={submit} disabled={pending} variant="contained">
          {pending ? 'Saving…' : loggedToday ? 'Update' : 'Log today'}
        </Button>
      </Stack>
    </Card>
  );
}
