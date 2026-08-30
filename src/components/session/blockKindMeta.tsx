import BoltIcon from '@mui/icons-material/Bolt';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import RepeatIcon from '@mui/icons-material/Repeat';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import type { BlockKind } from '@/core/types';

// Every `@mui/icons-material/*` icon shares this exact component shape —
// `SvgIconComponent` names it, but only the barrel re-export carries that
// name, and the barrel is banned (`eslint.config.mjs`'s `no-restricted-
// imports`, so every icon in this app tree-shakes instead of pulling the
// whole library in). Borrowing one real icon's own type is the same shape
// without importing from the barrel to get it.
type IconComponent = typeof WhatshotIcon;

/**
 * Every block kind used to render as the same accordion with the same
 * overline (docs/chunks/chunk-24-craft.md §2, finding #10) — the main lift
 * looked no different from a cooldown stretch until you actually read the
 * name. `Record<BlockKind, …>` keyed off the closed union in
 * `src/core/types.ts`: a new kind added there is a typecheck failure here,
 * not a silently unstyled block.
 *
 * Colours are drawn from roles that already exist in the palette — no new
 * tokens added, per the brief's own instruction. `main` gets `primary`
 * deliberately: it is the one block that must read as *the* block at a
 * glance.
 */
export const BLOCK_KIND_META: Record<BlockKind, { icon: IconComponent; color: string }> = {
  primer: { icon: WhatshotIcon, color: 'text.secondary' },
  main: { icon: FitnessCenterIcon, color: 'primary.main' },
  secondary: { icon: RepeatIcon, color: 'secondary.main' },
  superset: { icon: SyncAltIcon, color: 'tertiary.main' },
  finisher: { icon: BoltIcon, color: 'tertiary.main' },
  downregulate: { icon: SelfImprovementIcon, color: 'text.secondary' },
};
