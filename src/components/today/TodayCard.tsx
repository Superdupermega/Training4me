import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { mainLiftOf, minutes, WEEKDAY } from '@/components/format';
import { SkipSessionButton } from '@/components/today/SkipSessionButton';
import type { SessionRow } from '@/server/repo';

type FeaturedStatus = 'today' | 'next' | 'overdue';

const LABEL: Record<FeaturedStatus, (session: SessionRow) => string> = {
  today: () => 'Today',
  next: (session) => `Next · ${WEEKDAY[session.weekday]}`,
  overdue: (session) => `Missed · ${WEEKDAY[session.weekday]}`,
};

export function TodayCard({ session, status }: { session: SessionRow; status: FeaturedStatus }) {
  const main = mainLiftOf(session.blocks);
  return (
    <Card sx={{ p: 2.5, bgcolor: 'primaryContainer.main', color: 'primaryContainer.contrastText' }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="overline" sx={{ opacity: 0.85 }}>
            {LABEL[status](session)}
          </Typography>
          <Typography variant="h1">{session.title}</Typography>
        </Box>
        {status === 'overdue' && (
          <Typography sx={{ opacity: 0.9 }}>
            This was scheduled for {WEEKDAY[session.weekday]}. Do it now, or skip it and keep the block moving.
          </Typography>
        )}
        {main && (
          <Box>
            <Typography variant="h3">{main.name}</Typography>
            <Typography className="tnum" sx={{ opacity: 0.9 }}>{main.summary}</Typography>
          </Box>
        )}
        <Stack direction="row" spacing={1}>
          {/* Outlined + `color: inherit` rides on the card's own contrastText,
              so it stays legible against primaryContainer in both schemes —
              a fixed white-on-alpha chip was the fix's whole point. */}
          <Chip
            size="small" variant="outlined" label={`≈ ${minutes(session.estimatedSec)}`}
            sx={{ color: 'inherit', borderColor: 'currentColor' }}
          />
          {session.isDeload && (
            <Chip
              size="small" variant="outlined" label="Deload"
              sx={{ color: 'inherit', borderColor: 'currentColor' }}
            />
          )}
        </Stack>
        <Button
          component={Link} href={`/session/${session.id}`} size="large" fullWidth
          sx={{ bgcolor: 'background.paper', color: 'text.primary', '&:hover': { bgcolor: 'background.paper' } }}
        >
          {session.status === 'in_progress' ? 'Continue session' : 'Start session'}
        </Button>
        {status === 'overdue' && <SkipSessionButton sessionId={session.id} />}
      </Stack>
    </Card>
  );
}
