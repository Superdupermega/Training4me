'use client';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { visuallyHidden } from '@/components/visuallyHidden';
import { playRestAlert } from './restAlert';

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

  // Scheduled against the absolute endsAt with its own setTimeout, not
  // discovered by polling `remaining` in the 250ms display-refresh interval
  // above — that interval is throttled hard in a backgrounded tab (switching
  // to check something else mid-rest), which could delay `remaining`
  // reaching 0 well past the real end time, or never fire it while hidden at
  // all. A single absolute-time timeout still fires as scheduled. Re-runs
  // (and re-arms) whenever `endsAt` moves, which covers both a fresh rest
  // period and a +/-15s adjustment to this one.
  useEffect(() => {
    buzzed.current = false;
    const delay = Math.max(0, endsAt - Date.now());
    const id = window.setTimeout(() => {
      if (buzzed.current) return;
      buzzed.current = true;
      navigator.vibrate?.([120, 60, 120]);
      playRestAlert();
    }, delay);
    return () => window.clearTimeout(id);
  }, [endsAt]);

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
      <Stack spacing={1} sx={{ maxWidth: 680, mx: 'auto' }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <CircularProgress
            variant="determinate" value={progress} size={40} thickness={4}
            color={remaining === 0 ? 'success' : 'primary'}
          />
          {/*
            The countdown used to live as `variant="caption"` text packed
            inside the ring — unreadable at arm's length, let alone across a
            gym floor. `displayLarge` is the token docs/04-DESIGN-SYSTEM.md
            §2 specified for exactly this ("must read from 1 m away"); the
            ring stays as a slim at-a-glance progress indicator beside it
            rather than trying to frame text that no longer fits inside it.
          */}
          <Typography
            variant="displayLarge" className="tnum"
            sx={{ fontSize: { xs: '2.25rem', sm: '3rem' } }}
          >
            {label}
          </Typography>
          <Typography sx={{ flex: 1 }} color="text.secondary">
            {remaining === 0 ? 'Rest is up. Next set.' : 'Resting'}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button size="small" variant="outlined" onClick={() => onAdjust(-15)} aria-label="Fifteen seconds less">−15s</Button>
          <Button size="small" variant="outlined" onClick={() => onAdjust(15)} aria-label="Fifteen seconds more">+15s</Button>
          <Button size="small" onClick={onDismiss}>Skip</Button>
        </Stack>
      </Stack>
      {/*
        The visible timer is aria-live="off" on purpose — announcing every
        tick of a countdown would drown out everything else on the page.
        This hidden region instead announces exactly once, the moment rest
        ends, which is the one state change worth interrupting for.
      */}
      <Box aria-live="polite" sx={visuallyHidden}>
        {remaining === 0 ? 'Rest is up. Next set.' : ''}
      </Box>
    </Paper>
  );
}
