'use client';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
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
        // A floating card, not a full-width dock: it sits well clear of the
        // Finish button below it and leaves the sides of the screen free to
        // tap or scroll through, rather than gating the whole bottom edge
        // the way a full-bleed bar does.
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 'calc(96px + env(safe-area-inset-bottom))', zIndex: 20,
        width: 'calc(100% - 32px)', maxWidth: 440,
        borderRadius: 5, p: 1.5, bgcolor: 'background.paper',
        boxShadow: '0 12px 28px -8px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.12)',
      }}
      role="timer"
      aria-live="off"
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <CircularProgress
            variant="determinate" value={progress} size={48} thickness={4}
            color={remaining === 0 ? 'success' : 'primary'}
          />
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Typography variant="caption" className="tnum" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{label}</Typography>
          </Box>
        </Box>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} color="text.secondary" noWrap>
          {remaining === 0 ? 'Rest is up. Next set.' : 'Resting'}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <IconButton
            size="small" onClick={() => onAdjust(-15)} aria-label="Fifteen seconds less"
            sx={{ border: 1, borderColor: 'divider', borderRadius: 2, width: 40, height: 32, px: 0.5 }}
          >
            <Typography variant="caption" className="tnum" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>−15</Typography>
          </IconButton>
          <IconButton
            size="small" onClick={() => onAdjust(15)} aria-label="Fifteen seconds more"
            sx={{ border: 1, borderColor: 'divider', borderRadius: 2, width: 40, height: 32, px: 0.5 }}
          >
            <Typography variant="caption" className="tnum" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>+15</Typography>
          </IconButton>
          <IconButton size="small" onClick={onDismiss} aria-label="Skip rest" sx={{ bgcolor: 'action.selected', width: 32, height: 32 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      {/*
        The visible timer is aria-live="off" on purpose — announcing every
        tick of a countdown would drown out everything else on the page.
        This hidden region instead announces exactly once, the moment rest
        ends, which is the one state change worth interrupting for.
      */}
      <Box aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {remaining === 0 ? 'Rest is up. Next set.' : ''}
      </Box>
    </Paper>
  );
}
