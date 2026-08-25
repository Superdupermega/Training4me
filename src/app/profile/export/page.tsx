import DownloadIcon from '@mui/icons-material/Download';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppShell } from '@/components/AppShell';
import { PageContainer } from '@/components/PageContainer';

export const metadata = { title: 'Export — Training4me' };

/**
 * There was no way to get your own data out — years of training data lived
 * in one table inside a Supabase project shared with unrelated apps,
 * reachable only through this UI. See docs/07-PRODUCTION-REVIEW.md #16.
 *
 * Both downloads are plain links to route handlers
 * (src/app/api/export/{csv,json}/route.ts) rather than a button wired to a
 * server action — a real file download needs to be a normal browser
 * navigation with a Content-Disposition header, which a server action
 * result can't produce.
 */
export default function ExportPage() {
  return (
    <AppShell title="Export your data" backHref="/profile">
      <PageContainer>
        <Stack spacing={2.5}>
          <Typography color="text.secondary">
            Everything you have logged, in two forms. Neither touches anything — this only reads.
          </Typography>

          <Card variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h3">Logged sets (CSV)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              Every set you have ever logged, one row each — date, session, exercise, weight,
              reps, RPE. Opens in any spreadsheet.
            </Typography>
            <Button
              component="a" href="/api/export/csv" startIcon={<DownloadIcon />}
              variant="outlined"
            >
              Download CSV
            </Button>
          </Card>

          <Card variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h3">Full backup (JSON)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              Everything this app has stored about your training — profile, programs, sessions,
              logged sets, PRs, training maxes, and any routines you have built. A complete copy
              you can keep, independent of this app or the database behind it.
            </Typography>
            <Button
              component="a" href="/api/export/json" startIcon={<DownloadIcon />}
              variant="outlined"
            >
              Download JSON
            </Button>
          </Card>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
