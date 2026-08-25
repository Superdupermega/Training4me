'use client';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { GROUP_LABEL, type MuscleGroup } from '@/core/library/muscles';
import { COVERAGE_GROUPS } from './muscleCoverage';

/**
 * "What's left of the body" at a glance — the thing about the builder people
 * already like, made visible instead of implied. Trained groups sit on a
 * tinted, filled chip; everything still untouched stays a plain outline, so
 * the gaps read as gaps without a second look.
 */
export function MuscleCoverageStrip({ label, covered }: { label: string; covered: Set<MuscleGroup> }) {
  return (
    <Stack spacing={0.75}>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        {COVERAGE_GROUPS.map((g) => {
          const hit = covered.has(g);
          return (
            <Chip
              key={g}
              size="small"
              label={GROUP_LABEL[g]}
              variant={hit ? 'filled' : 'outlined'}
              sx={hit
                ? { bgcolor: 'primaryContainer.main', color: 'primaryContainer.contrastText' }
                : { color: 'text.secondary' }}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
