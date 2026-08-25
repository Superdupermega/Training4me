import Box from '@mui/material/Box';
import { EmptyChart } from './EmptyChart';

export interface LinePoint {
  label: string;
  value: number;
  /** Marks a personal record — drawn as a filled dot in the tertiary (gold) colour. */
  isPr?: boolean;
}

interface Props {
  points: LinePoint[];
  height?: number;
  formatValue?: (v: number) => string;
  emptyMessage?: string;
  unit?: string;
}

const PAD_X = 8;
const PAD_Y = 16;

/**
 * A single-series line chart. No client JS at all — pure SVG computed at
 * render time, `viewBox`-scaled so it's responsive with zero script. Colours
 * come from MUI's CSS-variable theme (`var(--mui-palette-*)`), which is
 * already correct in both light and dark, live, with no component re-render
 * needed on a theme switch.
 *
 * Every chart ships an accessible fallback: a visually-hidden `<table>` of
 * the same data, so a screen reader gets real values, not a `<path>`.
 */
export function LineChart({ points, height = 180, formatValue = String, emptyMessage, unit }: Props) {
  if (points.length < 2) {
    return (
      <EmptyChart
        height={height}
        message={emptyMessage ?? (points.length === 1
          ? `${formatValue(points[0]!.value)}${unit ?? ''} so far — one data point. A trend line needs at least two.`
          : 'Nothing logged yet — log a few sessions and a trend appears here.')}
      />
    );
  }

  const width = 400;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_Y * 2;

  const coords = points.map((p, i) => ({
    x: PAD_X + (i / (points.length - 1)) * innerW,
    y: PAD_Y + innerH - ((p.value - min) / range) * innerH,
    point: p,
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');

  return (
    <Box>
      <Box
        component="svg" viewBox={`0 0 ${width} ${height}`} width="100%" height={height}
        role="img" aria-label={`Trend from ${formatValue(points[0]!.value)} to ${formatValue(points[points.length - 1]!.value)}`}
      >
        <line
          x1={PAD_X} y1={PAD_Y + innerH} x2={width - PAD_X} y2={PAD_Y + innerH}
          stroke="var(--mui-palette-divider)" strokeWidth={1}
        />
        <path d={path} fill="none" stroke="var(--mui-palette-primary-main)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle
            key={i} cx={c.x} cy={c.y} r={c.point.isPr ? 4.5 : 3}
            fill={c.point.isPr ? 'var(--mui-palette-tertiary-main)' : 'var(--mui-palette-primary-main)'}
          />
        ))}
        <text x={PAD_X} y={PAD_Y - 4} fontSize={10} fill="var(--mui-palette-text-secondary)">
          {formatValue(max)}{unit ?? ''}
        </text>
        <text x={PAD_X} y={height - 2} fontSize={10} fill="var(--mui-palette-text-secondary)">
          {formatValue(min)}{unit ?? ''}
        </text>
      </Box>
      <Box
        component="table"
        sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      >
        <tbody>
          {points.map((p, i) => (
            <tr key={i}><td>{p.label}</td><td>{formatValue(p.value)}{unit ?? ''}</td></tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}
