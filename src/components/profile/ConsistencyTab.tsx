import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Heatmap } from '@/components/charts/Heatmap';
import type { CalendarDay, ConsistencySummary } from '@/server/analytics';

interface Props {
  summary: ConsistencySummary | null;
  calendar: CalendarDay[];
  paceFactor: number;
  today: string;
}

export function ConsistencyTab({ summary, calendar, paceFactor, today }: Props) {
  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">This block</Typography>
        {summary ? (
          <>
            <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1 }}>
              <Typography variant="h1" className="tnum">{summary.percent}%</Typography>
              <Typography color="text.secondary">
                {summary.completed} of {summary.total} sessions done · week {summary.weekNumber} of {summary.weeks}
              </Typography>
            </Stack>
            {summary.skipped > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {summary.skipped} skipped
              </Typography>
            )}
          </>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            No active block yet.
          </Typography>
        )}
      </Card>

      <Box>
        <Typography variant="overline" color="text.secondary">Last 12 weeks</Typography>
        <Card variant="outlined" sx={{ mt: 1, p: 2 }}>
          <Heatmap cells={calendar} weeks={12} today={today} />
        </Card>
      </Box>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Pace</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Sessions are estimated at {Math.round(paceFactor * 100)}% of the standard pace, calibrated
          from how long your last few sessions actually took.
        </Typography>
      </Card>
    </Stack>
  );
}
