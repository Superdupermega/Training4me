import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@/components/visuallyHidden';
import { GROUP_LABEL, MUSCLE_GROUPS, type MuscleGroup } from '@/core/library/muscles';
import { EmptyChart } from './EmptyChart';

export interface BodyMapGroup {
  group: MuscleGroup;
  sets: number;
}

/** A simple rounded-rectangle `<path>` `d` string — every body region below is one of these. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} `
    + `V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} `
    + `A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}
function circle(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

// Two coordinate sets, front and back, over a shared 100 x 200 figure. Not
// anatomically beautiful on purpose — docs/chunks/chunk-23-reward-loop.md
// §4 asks for two readable, distinguishable outlines, not a detailed
// drawing nobody can map to a muscle group. Each is a `Record<MuscleGroup,
// string>`, exhaustive by construction: a group added to
// `src/core/library/muscles.ts` without an entry here is a typecheck
// failure, not a silently unfilled shape.
//
// Not every group has a natural single region on both sides of the body —
// the chest doesn't show from behind, the hamstrings don't show from the
// front. Those instead get a small badge circle in the shared margin at the
// top of that silhouette: still exhaustive, still real coverage, just not
// pretending a region is visible where it is not.
export const FRONT_PATHS: Record<MuscleGroup, string> = {
  chest: roundedRect(28, 38, 44, 22, 6),
  shoulders: `${circle(24, 40, 9)} ${circle(76, 40, 9)}`,
  arms: `${roundedRect(12, 44, 12, 60, 6)} ${roundedRect(76, 44, 12, 60, 6)}`,
  core: roundedRect(32, 62, 36, 34, 6),
  quads: `${roundedRect(28, 100, 18, 46, 6)} ${roundedRect(54, 100, 18, 46, 6)}`,
  calves: `${roundedRect(29, 150, 16, 38, 6)} ${roundedRect(55, 150, 16, 38, 6)}`,
  carry_grip: `${circle(16, 108, 7)} ${circle(84, 108, 7)}`,
  back: circle(90, 16, 4),
  hamstrings_glutes: circle(90, 26, 4),
  cardio: circle(90, 36, 4),
  mobility: circle(90, 46, 4),
  full_body: circle(90, 56, 4),
};

export const BACK_PATHS: Record<MuscleGroup, string> = {
  back: roundedRect(26, 38, 48, 46, 6),
  shoulders: `${circle(24, 40, 9)} ${circle(76, 40, 9)}`,
  arms: `${roundedRect(12, 44, 12, 60, 6)} ${roundedRect(76, 44, 12, 60, 6)}`,
  hamstrings_glutes: roundedRect(28, 100, 44, 40, 6),
  calves: `${roundedRect(29, 150, 16, 38, 8)} ${roundedRect(55, 150, 16, 38, 8)}`,
  carry_grip: `${circle(16, 108, 7)} ${circle(84, 108, 7)}`,
  chest: circle(90, 16, 4),
  core: circle(90, 26, 4),
  quads: circle(90, 36, 4),
  cardio: circle(90, 46, 4),
  mobility: circle(90, 56, 4),
  full_body: circle(90, 66, 4),
};

/** Head/neck/leg outline — the same static, muted silhouette line under both maps. */
function Outline() {
  return (
    <>
      <path d={circle(50, 16, 12)} fill="none" stroke="var(--mui-palette-divider)" strokeWidth={1} />
      <path d={roundedRect(44, 26, 12, 12, 3)} fill="none" stroke="var(--mui-palette-divider)" strokeWidth={1} />
    </>
  );
}

const shade = (value: number, max: number) => {
  if (value === 0) return 'var(--mui-palette-action-hover)';
  const t = Math.min(1, value / max);
  if (t < 0.34) return 'var(--mui-palette-primaryContainer-main)';
  if (t < 0.67) return 'var(--mui-palette-primary-light)';
  return 'var(--mui-palette-primary-main)';
};

function Silhouette({ title, paths, byGroup, max }: {
  title: string; paths: Record<MuscleGroup, string>; byGroup: Map<MuscleGroup, number>; max: number;
}) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
        {title}
      </Typography>
      <Box component="svg" viewBox="0 0 100 200" width="100%" role="presentation">
        <Outline />
        {MUSCLE_GROUPS.map((g) => (
          <path key={g} d={paths[g]} fill={shade(byGroup.get(g) ?? 0, max)}>
            <title>{`${GROUP_LABEL[g]}: ${(byGroup.get(g) ?? 0).toFixed(1)} sets`}</title>
          </path>
        ))}
      </Box>
    </Box>
  );
}

/**
 * The visual `volumeByMuscleGroup()` (src/server/analytics.ts) always had
 * the data for and never had a body-shaped picture of — `MuscleCoverageStrip`
 * is chips, and lives only in the builder. Reuses `Heatmap.tsx`'s own
 * threshold shading (`action.hover` → `primaryContainer.main` →
 * `primary.light` → `primary.main`) so the two visuals read as one system,
 * not two different scales.
 */
export function BodyMap({ groups }: { groups: BodyMapGroup[] }) {
  const total = groups.reduce((sum, g) => sum + g.sets, 0);
  if (total === 0) {
    return <EmptyChart height={160} message="Nothing logged yet — a shape appears here once you have." />;
  }
  const byGroup = new Map(groups.map((g) => [g.group, g.sets]));
  const max = Math.max(...groups.map((g) => g.sets), 1);

  return (
    <Box>
      <Stack direction="row" spacing={3} sx={{ justifyContent: 'center' }}>
        <Silhouette title="Front" paths={FRONT_PATHS} byGroup={byGroup} max={max} />
        <Silhouette title="Back" paths={BACK_PATHS} byGroup={byGroup} max={max} />
      </Stack>
      <Box component="table" sx={visuallyHidden}>
        <tbody>
          {MUSCLE_GROUPS.map((g) => (
            <tr key={g}><td>{GROUP_LABEL[g]}</td><td>{(byGroup.get(g) ?? 0).toFixed(1)} sets</td></tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}
