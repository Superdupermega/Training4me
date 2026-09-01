'use client';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { visuallyHidden } from '@/components/visuallyHidden';
import { playRestAlert } from './restAlert';

export interface NextSetPreview {
  exerciseName: string;
  setNumber: number;
  target: string;
  weightKg?: number | null;
}

interface Props {
  endsAt: number;
  totalSec: number;
  onAdjust: (deltaSec: number) => void;
  onDismiss: () => void;
  /** What comes right after this rest — the block `SessionPlayer` already holds, computed once at `complete()` time. */
  nextSet?: NextSetPreview | null;
}

function nextSetLine(nextSet: NextSetPreview): string {
  const weight = nextSet.weightKg != null ? ` @ ${nextSet.weightKg} kg` : '';
  return `Up next: Set ${nextSet.setNumber} · ${nextSet.target}${weight} · ${nextSet.exerciseName}`;
}

/**
 * Driven by an absolute end timestamp rather than a counting interval, so
 * locking the phone mid-rest does not desynchronise the clock.
 */
export function RestTimer({ endsAt, totalSec, onAdjust, onDismiss, nextSet }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const buzzed = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // A fresh rest period starts collapsed — full-screen is opt-in per period,
  // never the default (the set list must stay reachable during rest).
  useEffect(() => setExpanded(false), [endsAt]);

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
      // Best-effort only — see the caveat below. A foreground tab gets the
      // vibrate/audio above regardless; this is the (unreliable) extra
      // attempt at reaching a backgrounded one.
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        navigator.serviceWorker?.ready
          .then((reg) => reg.showNotification('Rest is up', {
            body: nextSet ? nextSetLine(nextSet) : 'Next set.',
            icon: '/icon.svg', badge: '/icon.svg', tag: 'rest-timer',
          }))
          .catch(() => {});
      }
    }, delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nextSet is read once inside the timeout, not a reactive trigger for re-arming it
  }, [endsAt]);

  // Told once per rest period, not on every render — the service worker is
  // what might still be alive to fire the notification above if this tab
  // itself gets suspended before the timeout above runs. See the caveat
  // below: this does not make a backgrounded notification reliable, it is
  // the best this app can do without a server round trip for a 90-second
  // timer (docs/chunks/chunk-24-craft.md §1 is explicit that it should not
  // go through the cron/web-push path `src/server/push.ts` owns).
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    navigator.serviceWorker?.ready
      .then((reg) => reg.active?.postMessage({
        type: 'rest-timer', endsAt, body: nextSet ? nextSetLine(nextSet) : 'Next set.',
      }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nextSet's text is read once per period, not a reason to re-post
  }, [endsAt]);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const progress = totalSec > 0 ? Math.min(100, ((totalSec - remaining) / totalSec) * 100) : 100;
  const label = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  const liveRegion = (
    // The visible timer is aria-live="off" on purpose — announcing every
    // tick of a countdown would drown out everything else on the page. This
    // hidden region instead announces exactly once, the moment rest ends,
    // which is the one state change worth interrupting for.
    <Box aria-live="polite" sx={visuallyHidden}>
      {remaining === 0 ? 'Rest is up. Next set.' : ''}
    </Box>
  );

  if (expanded) {
    return (
      <Box
        role="timer"
        onClick={() => setExpanded(false)}
        sx={{
          position: 'fixed', inset: 0, zIndex: 30, bgcolor: 'rgba(0,0,0,0.75)', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, px: 3, textAlign: 'center', cursor: 'pointer',
        }}
      >
        <IconButton
          aria-label="Collapse" onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          sx={{ position: 'absolute', top: 16, right: 16, color: '#fff' }}
        >
          <CloseIcon />
        </IconButton>
        <Typography className="tnum" variant="displayLarge" sx={{ color: '#fff' }}>{label}</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          {remaining === 0 ? 'Rest is up. Next set.' : 'Resting'}
        </Typography>
        {nextSet && (
          <Typography className="tnum" sx={{ color: 'rgba(255,255,255,0.8)', maxWidth: 320 }}>
            {nextSetLine(nextSet)}
          </Typography>
        )}
        {liveRegion}
      </Box>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        // A floating card, clear of the "Finish session" bar below it,
        // rather than a full-bleed dock that used to wall off the whole
        // bottom edge together with that bar (and shove it up 96px while
        // resting) — see SessionPlayer.tsx's own comment on the same fix.
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 'calc(96px + env(safe-area-inset-bottom))', zIndex: 20,
        width: 'calc(100% - 32px)', maxWidth: 480,
        borderRadius: 4, p: 2, bgcolor: 'background.paper',
        boxShadow: '0 12px 28px -8px rgba(0,0,0,0.28), 0 2px 10px rgba(0,0,0,0.14)',
      }}
      role="timer"
      aria-live="off"
    >
      <Stack spacing={0.5}>
        <ButtonBase
          onClick={() => setExpanded(true)} aria-label="Expand rest timer"
          sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
            <CircularProgress
              variant="determinate" value={progress} size={40} thickness={4}
              color={remaining === 0 ? 'success' : 'primary'}
            />
            {/*
              The countdown used to live as `variant="caption"` text packed
              inside the ring — unreadable at arm's length, let alone across
              a gym floor. `displayLarge` is the token
              docs/04-DESIGN-SYSTEM.md §2 specified for exactly this ("must
              read from 1 m away"); the ring stays as a slim at-a-glance
              progress indicator beside it rather than trying to frame text
              that no longer fits inside it.
            */}
            <Typography
              variant="displayLarge" className="tnum"
              sx={{ fontSize: { xs: '2.25rem', sm: '3rem' } }}
            >
              {label}
            </Typography>
            <Box sx={{ flex: 1, textAlign: 'left' }}>
              <Typography color="text.secondary">
                {remaining === 0 ? 'Rest is up. Next set.' : 'Resting'}
              </Typography>
              {nextSet && (
                <Typography variant="body2" color="text.secondary" className="tnum" noWrap>
                  {nextSetLine(nextSet)}
                </Typography>
              )}
            </Box>
          </Stack>
        </ButtonBase>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button size="small" variant="outlined" onClick={() => onAdjust(-15)} aria-label="Fifteen seconds less">−15s</Button>
          <Button size="small" variant="outlined" onClick={() => onAdjust(15)} aria-label="Fifteen seconds more">+15s</Button>
          <Button size="small" onClick={onDismiss}>Skip</Button>
        </Stack>
      </Stack>
      {liveRegion}
    </Paper>
  );
}
