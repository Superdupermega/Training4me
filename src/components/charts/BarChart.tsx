import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { EmptyChart } from './EmptyChart';

export interface BarPoint {
  label: string;
  value: number;
}

interface Props {
  bars: BarPoint[];
  height?: number;
  formatValue?: (v: number) => string;
  emptyMessage?: string;
}

/** Vertical bars — weekly tonnage, sets per week, that kind of series-over-time data. */
export function BarChart({ bars, height = 160, formatValue = String, emptyMessage }: Props) {
  if (bars.every((b) => b.value === 0)) {
    return <EmptyChart height={height} message={emptyMessage ?? 'Nothing logged yet.'} />;
  }
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <Box>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-end', height }}>
        {bars.map((b, i) => (
          <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <Typography variant="caption" className="tnum" color="text.secondary" sx={{ fontSize: '0.65rem', mb: 0.25 }}>
              {b.value > 0 ? formatValue(b.value) : ''}
            </Typography>
            <Box
              role="img" aria-label={`${b.label}: ${formatValue(b.value)}`}
              sx={{
                width: '100%', minHeight: 2,
                height: `${Math.max(2, (b.value / max) * (height - 32))}px`,
                bgcolor: 'primary.main', borderRadius: '3px 3px 0 0',
              }}
            />
          </Box>
        ))}
      </Stack>
      <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
        {bars.map((b, i) => (
          <Typography key={i} variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: 'center', fontSize: '0.65rem' }} noWrap>
            {b.label}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

/** Horizontal bars — ranking muscle groups or exercises by volume. */
export function HorizontalBarChart({ bars, formatValue = String, emptyMessage }: Omit<Props, 'height'>) {
  if (bars.every((b) => b.value === 0)) {
    return <EmptyChart message={emptyMessage ?? 'Nothing logged yet.'} />;
  }
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <Stack spacing={1}>
      {bars.map((b, i) => (
        <Box key={i}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.25 }}>
            <Typography variant="body2" noWrap>{b.label}</Typography>
            <Typography variant="body2" color="text.secondary" className="tnum">{formatValue(b.value)}</Typography>
          </Stack>
          <Box
            role="img" aria-label={`${b.label}: ${formatValue(b.value)}`}
            sx={{ height: 8, borderRadius: 999, bgcolor: 'action.hover', overflow: 'hidden' }}
          >
            <Box sx={{ height: '100%', width: `${Math.max(3, (b.value / max) * 100)}%`, bgcolor: 'primary.main' }} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
