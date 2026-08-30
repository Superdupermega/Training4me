import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { plateLayout, type PlateBreakdown } from '@/core/plates';

// The convention people already read without a legend — real plates carry
// these colours (IWF-ish, not exact to any one federation). `2.5` reuses
// `25`'s red at a smaller width on purpose: real plates do this too. The
// three micro denominations (this app's own `microPlates` option, not a
// competition set) get a chrome-grey scale instead — nobody has a
// colour convention memorised for a 0.25 kg plate.
const PLATE_COLOR: Record<number, string> = {
  25: '#D32F2F', 20: '#1565C0', 15: '#F5C518', 10: '#2E7D32', 5: '#F5F5F5',
  2.5: '#D32F2F', 1.25: '#9E9E9E', 0.5: '#BDBDBD', 0.25: '#E0E0E0',
};

/**
 * `plateBreakdown()` already returns structured per-side plate data;
 * `SetRow.tsx` used to render it as the string "20 + 15 per side" alone.
 * This draws it — a short bar, one segment per plate, width proportional to
 * its own weight (`plateLayout`, `src/core/plates.ts`, the pure part of
 * this). The text line stays too: it is what a screen reader gets, via
 * `aria-label` here rather than a second visible line.
 */
export function PlateBar({ breakdown, label }: { breakdown: PlateBreakdown; label: string }) {
  const segments = plateLayout(breakdown.perSide);
  if (segments.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.5 }}>
      <Box
        role="img" aria-label={label}
        sx={{
          flex: 1, display: 'flex', height: 22, borderRadius: 0.5, overflow: 'hidden',
          border: 1, borderColor: 'divider',
          // A closest-loadable breakdown must not silently read as an exact
          // one — the text caption already says so ("closest at 97.5 kg");
          // the bar echoes it with a dashed rather than solid outline.
          ...(breakdown.exact ? {} : { borderStyle: 'dashed' }),
        }}
      >
        {segments.map((s, i) => (
          <Box
            key={i}
            sx={{
              width: `${s.widthFraction * 100}%`, bgcolor: PLATE_COLOR[s.weightKg] ?? 'grey.400',
              borderRight: i < segments.length - 1 ? '1px solid rgba(0,0,0,0.25)' : 'none',
            }}
          />
        ))}
      </Box>
    </Stack>
  );
}
