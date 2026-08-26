'use client';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { useEffect } from 'react';

/**
 * Segment-level error boundary — catches anything thrown while rendering a
 * page or a server action's result, everywhere below the root layout. Still
 * renders inside <Providers>, so the theme and MUI context are available.
 * (The root layout itself has its own boundary: global-error.tsx.)
 *
 * Before this existed, any render error in production showed Next's bare
 * "Application error: a client-side exception has occurred" with no way
 * back — and installed as a standalone PWA there is no browser chrome, no
 * back button, nothing. This is the fix (docs/07-PRODUCTION-REVIEW.md #20).
 */
export default function ErrorBoundary({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // No real error-reporting service is wired up yet
    // (docs/07-PRODUCTION-REVIEW.md #26) — this at least gets the crash into
    // Vercel's own function logs instead of only this one browser's
    // console. Fire-and-forget: a failed report is never worse than the
    // crash it's reporting. See api/log-client-error/route.ts for why this
    // is a plain fetch to a route handler, not a server action.
    fetch('/api/log-client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        boundary: 'error', message: error.message, stack: error.stack,
        digest: error.digest, url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <Stack
      spacing={2}
      sx={{
        minHeight: '100dvh', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', px: 3,
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
      <Typography variant="h2">Something went wrong</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 320 }}>
        This screen hit a snag. Nothing you already logged was lost — try
        again, or head back to today&apos;s session.
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <Button onClick={() => reset()} variant="outlined" size="large">Try again</Button>
        <Button component="a" href="/today" variant="contained" size="large">Go to Today</Button>
      </Stack>
    </Stack>
  );
}
