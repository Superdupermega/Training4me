import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import type { MovementPattern } from '@/core/types';

function circleArc(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`;
}

// One abstract, hand-drawn glyph per movement pattern — not per exercise
// (286 of those and counting), and not licensed video or photography (see
// docs/10-FEEL-AND-POLISH.md §4). `Record<MovementPattern, string>`, keyed
// off the closed union in `src/core/types.ts`: a pattern added there without
// an entry here is a typecheck failure, not a silently blank glyph. Every
// entry is a stroke path, drawn with `currentColor` in a shared 24x24
// viewBox — simple enough to read at list-row size, not attempting to
// depict the actual exercise.
export const PATTERN_GLYPH: Record<MovementPattern, string> = {
  squat: 'M12 4 V13 M8 9 L12 13 L16 9', // a descent, knees bending
  hinge: 'M7 5 V13 L18 19', // upright, then a hinge at the hip
  lunge: 'M5 20 V11 M13 20 V4', // a staggered stance, one leg forward
  push_h: 'M4 12 H16 M11 7 L16 12 L11 17', // pressed away from the body
  push_v: 'M12 20 V4 M7 9 L12 4 L17 9', // pressed overhead
  pull_h: 'M20 12 H8 M13 7 L8 12 L13 17', // drawn in toward the body
  pull_v: 'M12 4 V20 M7 15 L12 20 L17 15', // drawn down, lat-pulldown direction
  carry: 'M7 4 V20 M17 4 V20 M4 20 H10 M14 20 H20', // two loaded hands, held
  trunk: `${circleArc(12, 12, 7)} M12 5 L15 3 M12 5 L14 7`, // rotation, with an arrowhead
  aerobic: 'M2 13 H8 L10 6 L14 20 L16 13 H22', // a pulse line
  mobility: 'M12 4 A8 8 0 1 1 4.6 8.9 M4.6 8.9 L3 6 M4.6 8.9 L7.3 9.6', // an open rotating arc
  isolation_upper: `${circleArc(12, 7, 3)} M12 10 V20`, // one joint moving, load below
  isolation_lower: `M12 4 V14 ${circleArc(12, 17, 3)}`, // one joint moving, load above
};

interface Props {
  pattern: MovementPattern;
  size?: number;
  sx?: SxProps<Theme>;
}

/** Renders one `PATTERN_GLYPH` entry. `aria-hidden` — the exercise name next to it is the accessible label. */
export function PatternGlyph({ pattern, size = 24, sx }: Props) {
  return (
    <Box
      component="svg" viewBox="0 0 24 24" width={size} height={size} aria-hidden
      sx={{ color: 'text.secondary', flexShrink: 0, ...sx }}
    >
      <path
        d={PATTERN_GLYPH[pattern]} fill="none" stroke="currentColor"
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
    </Box>
  );
}
