import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WifiOffIcon from '@mui/icons-material/WifiOff';

/**
 * Precached by the service worker (public/sw.js) and served in place of the
 * browser's own offline error whenever a page navigation can't reach the
 * network. Deliberately static — no data fetching, nothing that could itself
 * need a connection — and excluded from the PIN gate (middleware.ts) for the
 * same reason /unlock is: a page reachable with zero network has to stay
 * reachable with zero network.
 *
 * Sets logged while offline are never at risk — that is the outbox
 * (idb-keyval, src/components/session/outbox.ts), a separate mechanism that
 * queues locally and flushes on reconnect. This page only covers "can't load
 * the app shell at all right now."
 */
export default function OfflinePage() {
  return (
    <Stack
      spacing={2}
      sx={{
        minHeight: '100dvh', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', px: 3,
      }}
    >
      <WifiOffIcon aria-hidden sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.4 }} />
      <Typography variant="h2">You&apos;re offline</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 320 }}>
        Training4me needs a connection to load your program and history.
        Sets already in progress are saved on this device and will sync as
        soon as you&apos;re back online.
      </Typography>
      <Button component="a" href="/today" variant="contained" size="large">
        Try again
      </Button>
    </Stack>
  );
}
