import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { mainLiftOf, minutes, WEEKDAY } from '@/components/format';
import type { SessionRow } from '@/server/repo';

export function TodayCard({ session, isToday }: { session: SessionRow; isToday: boolean }) {
  const main = mainLiftOf(session.blocks);
  return (
    <Card sx={{ p: 2.5, bgcolor: 'primaryContainer.main', color: 'primaryContainer.contrastText' }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="overline" sx={{ opacity: 0.85 }}>
            {isToday ? 'Today' : `Next · ${WEEKDAY[session.weekday]}`}
          </Typography>
          <Typography variant="h1">{session.title}</Typography>
        </Box>
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
      </Stack>
    </Card>
  );
}
