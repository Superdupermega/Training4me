import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { BarChart, HorizontalBarChart } from '@/components/charts/BarChart';
import type { MuscleGroupVolume, WeekBucket } from '@/server/analytics';

interface Props {
  weekly: WeekBucket[];
  byMuscleGroup: MuscleGroupVolume[];
}

export function VolumeTab({ weekly, byMuscleGroup }: Props) {
  const thisWeek = weekly[weekly.length - 1]?.sets ?? 0;
  const priorWeeks = weekly.slice(0, -1);
  const average = priorWeeks.length
    ? Math.round(priorWeeks.reduce((sum, w) => sum + w.sets, 0) / priorWeeks.length)
    : 0;
  const vsAverage = average > 0 ? Math.round(((thisWeek - average) / average) * 100) : null;

  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">This week</Typography>
        <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1 }}>
          <Typography variant="h1" className="tnum">{thisWeek}</Typography>
          <Typography color="text.secondary">sets</Typography>
        </Stack>
        {vsAverage != null && (
          <Typography variant="body2" color="text.secondary">
            {vsAverage >= 0 ? '+' : ''}{vsAverage}% vs your {priorWeeks.length}-week average ({average})
          </Typography>
        )}
      </Card>

      <Box>
        <Typography variant="overline" color="text.secondary">Weekly sets</Typography>
        <Card variant="outlined" sx={{ mt: 1, p: 2 }}>
          <BarChart bars={weekly.map((w) => ({ label: w.label, value: w.sets }))} />
        </Card>
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">Sets by muscle group · last 4 weeks</Typography>
        <Card variant="outlined" sx={{ mt: 1, p: 2 }}>
          <HorizontalBarChart
            bars={byMuscleGroup.slice(0, 10).map((g) => ({ label: g.label, value: g.sets }))}
            formatValue={(v) => v.toFixed(v % 1 === 0 ? 0 : 1)}
          />
        </Card>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          A set is credited to all the muscle groups its exercise primarily works, split evenly —
          a squat counts toward both Quads and Hamstrings &amp; glutes.
        </Typography>
      </Box>
    </Stack>
  );
}
