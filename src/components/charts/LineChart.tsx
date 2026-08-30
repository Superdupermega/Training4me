import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@/components/visuallyHidden';
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
  /**
   * Unique among every `LineChart` rendered on the same page — becomes this
   * instance's `<linearGradient>` id. A `<defs><linearGradient id="...">`
   * shared by two charts means the second chart's fill silently references
   * the first's gradient (or vice versa, depending on paint order).
   *
   * A required prop, not `useId()`: this component has no `'use client'`
   * directive and is rendered as a genuine Server Component in at least one
   * caller (`BodyTab.tsx`, zero client JS) — `useId()` cannot be called
   * there at all. The caller already knows what's unique about its own
   * chart (an exercise id, a metric name); that is more reliable than a
   * hook this component cannot safely use everywhere it is used.
   */
  chartId: string;
}

const PAD_X = 8;
const PAD_Y = 16;
const LABEL_H = 14;

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

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
export function LineChart({ points, height = 180, formatValue = String, emptyMessage, unit, chartId }: Props) {
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
  const floor = (PAD_Y + innerH).toFixed(1);
  const areaPath = `${path} L ${coords[coords.length - 1]!.x.toFixed(1)} ${floor} `
    + `L ${coords[0]!.x.toFixed(1)} ${floor} Z`;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const delta = Math.round((last.value - first.value) * 10) / 10;
  const gradientId = `linechart-fill-${chartId}`;

  // First, middle and last `point.label` only — every label on a 12-point
  // series is unreadable at 400px wide.
  const labelIndices = new Set([0, Math.round((points.length - 1) / 2), points.length - 1]);
  const anchorFor = (i: number) => (i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle');

  return (
    <Box>
      {/* The single cheapest, highest-value addition here: what changed,
          named, above the shape you'd otherwise have to read off two corner
          numbers yourself. */}
      <Typography variant="body2" color="text.secondary" className="tnum" sx={{ mb: 0.5 }}>
        {signed(delta)}{unit ?? ''} from {first.label} to {last.label}
      </Typography>
      <Box
        component="svg" viewBox={`0 0 ${width} ${height + LABEL_H}`} width="100%" height={height + LABEL_H}
        role="img" aria-label={`Trend from ${formatValue(first.value)} to ${formatValue(last.value)}`}
      >
        {/*
          Tap-to-inspect via a plain sibling-selector reveal, not client
          state — this keeps the component server-rendered. `.lc-hit` is a
          transparent, enlarged (24px) hit circle sitting over each visible
          (3-4.5px) dot, `tabIndex={0}` so it is keyboard-reachable with no
          script; the adjacent `.lc-tip` group is its label, hidden until
          that exact circle is hovered or focused.
        */}
        <style>{'.lc-hit{cursor:pointer}.lc-hit:hover+.lc-tip,.lc-hit:focus+.lc-tip{opacity:1}'}</style>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--mui-palette-primary-main)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--mui-palette-primary-main)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <line
          x1={PAD_X} y1={PAD_Y + innerH} x2={width - PAD_X} y2={PAD_Y + innerH}
          stroke="var(--mui-palette-divider)" strokeWidth={1}
        />
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={path} fill="none" stroke="var(--mui-palette-primary-main)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <g key={i}>
            <circle
              cx={c.x} cy={c.y} r={c.point.isPr ? 4.5 : 3}
              fill={c.point.isPr ? 'var(--mui-palette-tertiary-main)' : 'var(--mui-palette-primary-main)'}
            />
            <circle className="lc-hit" cx={c.x} cy={c.y} r={12} fill="transparent" tabIndex={0}>
              <title>{`${c.point.label}: ${formatValue(c.point.value)}${unit ?? ''}`}</title>
            </circle>
            <g className="lc-tip" opacity={0} style={{ transition: 'opacity 120ms ease' }} pointerEvents="none">
              <rect
                x={Math.min(width - 52, Math.max(4, c.x - 26))} y={Math.max(0, c.y - 26)}
                width={52} height={16} rx={4} fill="var(--mui-palette-surfaceContainerHigh-main)"
              />
              <text
                x={Math.min(width - 26, Math.max(30, c.x))} y={Math.max(12, c.y - 14)}
                fontSize={9} textAnchor="middle" fill="var(--mui-palette-text-primary)"
              >
                {formatValue(c.point.value)}
              </text>
            </g>
          </g>
        ))}
        {coords.map((c, i) => labelIndices.has(i) && (
          <text
            key={i} x={c.x} y={height + LABEL_H - 2} fontSize={9} textAnchor={anchorFor(i)}
            fill="var(--mui-palette-text-secondary)"
          >
            {c.point.label}
          </text>
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
        sx={visuallyHidden}
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
