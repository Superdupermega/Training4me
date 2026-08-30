import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { today as todayInTimeZone } from '@/core/dates';
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
export function Heatmap({
  cells, weeks = 12, today = todayInTimeZone(),
}: { cells: HeatCell[]; weeks?: number; today?: string }) {
  const hasAny = cells.some((c) => c.value > 0);
  if (!hasAny) {
    return <EmptyChart height={120} message="Nothing logged yet — your training days fill in here." />;
  }

  const byDate = new Map(cells.map((c) => [c.date, c.value]));
  const max = Math.max(...cells.map((c) => c.value), 1);

  const days: { date: string; value: number }[] = [];
  const totalDays = weeks * 7;
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    // `today` is a plain YYYY-MM-DD, not a moment — shift it as a UTC noon
    // Date purely to walk whole calendar days, same trick as
    // src/core/dates.ts's daysFromToday, so this never re-derives "today"
    // from the server's own UTC clock the way the old `new Date()` here did.
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
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

  // 20px, up from the original 12px — a comfortable tap target, not just a
  // pixel. Each cell reveals its date and set count on tap or focus via a
  // plain CSS sibling reveal (`.hm-cell:hover + .hm-tip`), the same
  // no-client-JS technique `LineChart.tsx`'s tap-to-inspect uses — this
  // component still ships zero client JS.
  const CELL = 20;

  return (
    <Box>
      <style>{'.hm-cell{cursor:pointer}.hm-cell:hover+.hm-tip,.hm-cell:focus+.hm-tip{opacity:1}'}</style>
      <Stack direction="row" spacing={0.5}>
        <Stack spacing={0.5} sx={{ mr: 0.5 }}>
          {WEEKDAY_LABEL.map((d, i) => (
            <Typography key={i} variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', height: CELL, lineHeight: `${CELL}px` }}>
              {i % 2 === 0 ? d : ''}
            </Typography>
          ))}
        </Stack>
        {/*
          The grid scrolls inside this box, not the page — `overflowX: auto`
          here, nothing wider on the ancestor chain, confirmed at 20px cells
          (up from 12px) with a 12-week window.
        */}
        <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto' }}>
          {columns.map((col, ci) => (
            <Stack key={ci} spacing={0.5}>
              {col.map((cell, ri) => (
                <Box key={ri} sx={{ position: 'relative' }}>
                  <Box
                    className={cell ? 'hm-cell' : undefined}
                    tabIndex={cell ? 0 : undefined}
                    role={cell ? 'img' : undefined}
                    aria-label={cell ? `${cell.date}: ${cell.value} sets` : undefined}
                    sx={{
                      width: CELL, height: CELL, borderRadius: 0.5,
                      bgcolor: cell ? shade(cell.value) : 'transparent',
                    }}
                  />
                  {cell && (
                    <Box
                      className="hm-tip"
                      sx={{
                        position: 'absolute', bottom: `calc(100% + 4px)`, left: '50%', transform: 'translateX(-50%)',
                        opacity: 0, transition: 'opacity 120ms ease', pointerEvents: 'none', zIndex: 1,
                        bgcolor: 'surfaceContainerHigh.main', color: 'text.primary', borderRadius: 1,
                        px: 0.75, py: 0.25, whiteSpace: 'nowrap',
                      }}
                    >
                      <Typography variant="caption" className="tnum">{cell.date}: {cell.value}</Typography>
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
