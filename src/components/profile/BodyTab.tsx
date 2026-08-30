import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LineChart } from '@/components/charts/LineChart';
import { BodyweightCard } from './BodyweightCard';
import type { BodyweightEntry } from '@/server/repo';

interface Props {
  entries: BodyweightEntry[];
  today: string;
}

/**
 * Resolves the "Body tab" DECISIONS.md (2026-08-25, chunk 20) deferred for
 * needing its own table — that table now exists
 * (docs/07-PRODUCTION-REVIEW.md #19). Direction (gaining vs. losing) isn't
 * judged here the way the Strength tab judges an e1rm going up: unlike a
 * training max, more or less bodyweight isn't inherently the goal.
 */
export function BodyTab({ entries, today }: Props) {
  const last = entries[entries.length - 1] ?? null;

  return (
    <Stack spacing={2}>
      <BodyweightCard lastKg={last?.kg ?? null} lastDate={last?.date ?? null} today={today} />

      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h3">Bodyweight</Typography>
        {/* The change-over-time figure lives in `LineChart` itself now (its own delta headline, chunk 23 §3). */}
        <Box sx={{ mt: 1.5 }}>
          <LineChart
            chartId="bodyweight"
            points={entries.map((e) => ({ label: e.date, value: e.kg }))}
            formatValue={(v) => v.toFixed(1)}
            unit=" kg"
          />
        </Box>
      </Card>
    </Stack>
  );
}
