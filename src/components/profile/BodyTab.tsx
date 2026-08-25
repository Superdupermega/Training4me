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
  const first = entries[0];
  const delta = first && last && first !== last ? Math.round((last.kg - first.kg) * 10) / 10 : null;

  return (
    <Stack spacing={2}>
      <BodyweightCard lastKg={last?.kg ?? null} lastDate={last?.date ?? null} today={today} />

      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography variant="h3">Bodyweight</Typography>
          {delta != null && (
            <Typography variant="body2" className="tnum" color="text.secondary">
              {delta > 0 ? '+' : ''}{delta} kg over this window
            </Typography>
          )}
        </Stack>
        <Box sx={{ mt: 1.5 }}>
          <LineChart
            points={entries.map((e) => ({ label: e.date, value: e.kg }))}
            formatValue={(v) => v.toFixed(1)}
            unit=" kg"
          />
        </Box>
      </Card>
    </Stack>
  );
}
