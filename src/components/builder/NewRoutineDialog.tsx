'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createRoutine } from '@/server/actions';

export function NewRoutineDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const result = await createRoutine({ name: name.trim() || 'My program', weeks, daysPerWeek });
    setPending(false);
    if (result.ok) router.push(`/program/builder/${result.data!.routineId}`);
    else setError(result.error);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Build a program</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            autoFocus label="Name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Upper/Lower" fullWidth size="small"
          />
          <Stack spacing={0.5}>
            <Typography variant="overline" color="text.secondary">Days per week</Typography>
            <ToggleButtonGroup exclusive fullWidth value={daysPerWeek} onChange={(_, v) => v && setDaysPerWeek(v)}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <ToggleButton key={n} value={n}>{n}</ToggleButton>)}
            </ToggleButtonGroup>
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="overline" color="text.secondary">Weeks</Typography>
            <ToggleButtonGroup exclusive fullWidth value={weeks} onChange={(_, v) => v && setWeeks(v)}>
              {[4, 6, 8, 12].map((n) => <ToggleButton key={n} value={n}>{n}</ToggleButton>)}
            </ToggleButtonGroup>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button disabled={pending} onClick={submit}>{pending ? 'Creating…' : 'Create'}</Button>
      </DialogActions>
    </Dialog>
  );
}
