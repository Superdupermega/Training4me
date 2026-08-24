'use client';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';

interface Props {
  endsAt: number;
  totalSec: number;
  onAdjust: (deltaSec: number) => void;
  onDismiss: () => void;
}

/**
 * Driven by an absolute end timestamp rather than a counting interval, so
 * locking the phone mid-rest does not desynchronise the clock.
 */
export function RestTimer({ endsAt, totalSec, onAdjust, onDismiss }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const buzzed = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (remaining === 0 && !buzzed.current) {
      buzzed.current = true;
      navigator.vibrate?.([120, 60, 120]);
    }
    if (remaining > 0) buzzed.current = false;
  }, [remaining]);

  const progress = totalSec > 0 ? Math.min(100, ((totalSec - remaining) / totalSec) * 100) : 100;
  const label = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20,
        borderTop: 1, borderColor: 'divider', p: 2,
        pb: 'calc(16px + env(safe-area-inset-bottom))', bgcolor: 'background.paper',
      }}
      role="timer"
      aria-live="off"
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', maxWidth: 680, mx: 'auto' }}>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress
            variant="determinate" value={progress} size={56} thickness={4}
            color={remaining === 0 ? 'success' : 'primary'}
          />
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Typography variant="caption" className="tnum" sx={{ fontWeight: 700 }}>{label}</Typography>
          </Box>
        </Box>
        <Typography sx={{ flex: 1 }} color="text.secondary">
          {remaining === 0 ? 'Rest is up. Next set.' : 'Resting'}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => onAdjust(-15)} aria-label="Fifteen seconds less">−15s</Button>
        <Button size="small" variant="outlined" onClick={() => onAdjust(15)} aria-label="Fifteen seconds more">+15s</Button>
        <Button size="small" onClick={onDismiss}>Skip</Button>
      </Stack>
    </Paper>
  );
}
