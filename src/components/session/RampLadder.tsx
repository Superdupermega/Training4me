import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatWeight } from '@/components/format';
import { STANDARD_BAR_KG } from '@/core/plates';
import type { PrescribedSet } from '@/core/types';

/** "empty bar → 60 → 80 → 92.5, then work" — the progression at a glance. */
function ladderText(ramps: PrescribedSet[]): string {
  const steps = ramps.map((s) => (
    s.weightKg != null && s.weightKg <= STANDARD_BAR_KG ? 'empty bar' : formatWeight(s.weightKg ?? 0)
  ));
  return `${steps.join(' → ')}, then work`;
}

/**
 * Ramp sets render as faded, undifferentiated rows today — three rows that
 * look like working sets with the volume turned down, not a ladder up to
 * one (finding #15). This wraps them as one visual unit, above the working
 * sets it leads into; each ramp set inside is still whatever `children`
 * passes in (`SetRow`, unforked, individually loggable exactly as before —
 * this is presentation only, `totals`/`blockDone` never see this file).
 */
export function RampLadder({ ramps, children }: { ramps: PrescribedSet[]; children: React.ReactNode }) {
  if (ramps.length === 0) return null;
  return (
    <Box sx={{ bgcolor: 'action.hover', mb: 0.5 }}>
      <Stack sx={{ px: 2, pt: 1, pb: 0.5 }}>
        <Typography variant="overline" color="text.secondary">Warm-up ladder</Typography>
        <Typography variant="body2" color="text.secondary" className="tnum">{ladderText(ramps)}</Typography>
      </Stack>
      {children}
    </Box>
  );
}
