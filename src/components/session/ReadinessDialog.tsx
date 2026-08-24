'use client';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { readinessBand } from '@/core/progression/readiness';
import type { Readiness } from '@/core/types';

const FIELDS: { key: keyof Readiness; label: string; low: string; high: string }[] = [
  { key: 'sleep', label: 'Sleep', low: 'Terrible', high: 'Great' },
  { key: 'soreness', label: 'Body', low: 'Wrecked', high: 'Fresh' },
  { key: 'stress', label: 'Head', low: 'Frazzled', high: 'Calm' },
];

export function ReadinessDialog({
  open, onSubmit, onSkip,
}: { open: boolean; onSubmit: (r: Readiness) => void; onSkip: () => void }) {
  const [value, setValue] = useState<Readiness>({ sleep: 3, soreness: 3, stress: 3 });
  const band = readinessBand(value.sleep + value.soreness + value.stress);

  return (
    <Dialog open={open} fullWidth maxWidth="xs" onClose={onSkip}>
      <DialogTitle>How are you today?</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {FIELDS.map((field) => (
            <Stack key={field.key} spacing={0.5}>
              <Typography variant="overline" color="text.secondary">{field.label}</Typography>
              <Slider
                value={value[field.key]} min={1} max={5} step={1} marks
                valueLabelDisplay="off"
                aria-label={field.label}
                onChange={(_, next) => setValue((prev) => ({ ...prev, [field.key]: next as number }))}
              />
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">{field.low}</Typography>
                <Typography variant="caption" color="text.secondary">{field.high}</Typography>
              </Stack>
            </Stack>
          ))}
          <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>{band.message}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" onClick={onSkip}>Skip</Button>
        <Button onClick={() => onSubmit(value)}>Start</Button>
      </DialogActions>
    </Dialog>
  );
}
