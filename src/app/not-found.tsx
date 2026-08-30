import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SearchOffIcon from '@mui/icons-material/SearchOff';

/**
 * Replaces Next's unstyled default 404. Renders inside the root layout (and
 * so inside <Providers>), reached whenever a route or a dynamic segment
 * (e.g. `/exercises/[id]` for a bad id) doesn't resolve. Installed as a
 * standalone PWA there is no address bar to retype from — this needs to be
 * a real way back, not a dead end (docs/07-PRODUCTION-REVIEW.md #20).
 */
export default function NotFound() {
  return (
    <Stack
      spacing={2}
      sx={{
        minHeight: '100dvh', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', px: 3,
      }}
    >
      <SearchOffIcon aria-hidden sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.4 }} />
      <Typography variant="h2">Page not found</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 320 }}>
        There&apos;s nothing here. It may have moved, or the link was wrong.
      </Typography>
      <Button component="a" href="/today" variant="contained" size="large">
        Go to Today
      </Button>
    </Stack>
  );
}
