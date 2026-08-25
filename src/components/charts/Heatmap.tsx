import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { EmptyChart } from './EmptyChart';

export interface HeatCell {
  date: string; // ISO yyyy-mm-dd
  value: number; // working sets that day
}

const WEEKDAY_LABEL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A calendar heatmap over the last 12 weeks (not 12 months — see
 * DECISIONS.md: a shorter, denser window reads better at phone width and
 * needs no horizontal scroll). One column per week, Monday at the top.
 */
export function Heatmap({ cells, weeks = 12 }: { cells: HeatCell[]; weeks?: number }) {
  const hasAny = cells.some((c) => c.value > 0);
  if (!hasAny) {
    return <EmptyChart height={120} message="Nothing logged yet — your training days fill in here." />;
  }

  const byDate = new Map(cells.map((c) => [c.date, c.value]));
  const max = Math.max(...cells.map((c) => c.value), 1);

  const today = new Date();
  const days: { date: string; value: number }[] = [];
  const totalDays = weeks * 7;
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ date: iso, value: byDate.get(iso) ?? 0 });
  }
  // Pad to start on a Monday so columns line up as clean weeks.
  const firstWeekday = (new Date(days[0]!.date).getDay() + 6) % 7; // 0 = Monday
  const padded = [...Array.from({ length: firstWeekday }, () => null), ...days] as ({ date: string; value: number } | null)[];
  const columns: ({ date: string; value: number } | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) columns.push(padded.slice(i, i + 7));

  const shade = (value: number) => {
    if (value === 0) return 'action.hover';
    const t = Math.min(1, value / max);
    if (t < 0.34) return 'primaryContainer.main';
    if (t < 0.67) return 'primary.light';
    return 'primary.main';
  };

  return (
    <Box>
      <Stack direction="row" spacing={0.5}>
        <Stack spacing={0.5} sx={{ mr: 0.5 }}>
          {WEEKDAY_LABEL.map((d, i) => (
            <Typography key={i} variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', height: 12, lineHeight: '12px' }}>
              {i % 2 === 0 ? d : ''}
            </Typography>
          ))}
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto' }}>
          {columns.map((col, ci) => (
            <Stack key={ci} spacing={0.5}>
              {col.map((cell, ri) => (
                <Box
                  key={ri}
                  role={cell ? 'img' : undefined}
                  aria-label={cell ? `${cell.date}: ${cell.value} sets` : undefined}
                  sx={{
                    width: 12, height: 12, borderRadius: 0.5,
                    bgcolor: cell ? shade(cell.value) : 'transparent',
                  }}
                />
              ))}
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
