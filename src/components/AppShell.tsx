import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { BottomNav } from './nav/BottomNav';
import { NavRail, RAIL_WIDTH } from './nav/NavRail';
import { TopBar } from './nav/TopBar';

interface Props {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  /** For a sub-page reached from a destination (e.g. /profile/settings). */
  backHref?: string;
}

/**
 * The five-destination shell: BottomNavigation on mobile, a navigation rail
 * on desktop (≥ 900px), same routes either way. Both are always rendered and
 * switched with CSS `display`, never branched in JS, so there is no
 * hydration flash on first paint (docs/06-REDESIGN-PLAN.md §4/chunk 15).
 *
 * Content width is each page's own call via `<PageContainer>` — this shell
 * only owns the nav chrome and the safe-area padding around it.
 */
export function AppShell({ children, title, action, backHref }: Props) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex' }}>
      <NavRail />
      <Box sx={{ flex: 1, minWidth: 0, ml: { xs: 0, md: `${RAIL_WIDTH}px` } }}>
        {title && <TopBar title={title} action={action} backHref={backHref} />}
        <Box
          sx={{
            px: 2, pt: 2,
            pb: { xs: 'calc(72px + env(safe-area-inset-bottom))', md: 4 },
          }}
        >
          {children}
        </Box>
      </Box>
      <BottomNav />
    </Box>
  );
}
