import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import type { ContentWidth } from './PageContainer';
import { BottomNav } from './nav/BottomNav';
import { RAIL_WIDTH } from './nav/layout';
import { NavRail } from './nav/NavRail';
import { TopBar } from './nav/TopBar';

interface Props {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  /** For a sub-page reached from a destination (e.g. /profile/settings). */
  backHref?: string;
  /**
   * The content column this page uses — must match the page's own
   * `<PageContainer width>`, so the top bar's title sits on the same grid as
   * the heading beneath it.
   */
  width?: ContentWidth;
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
export function AppShell({ children, title, action, backHref, width = 'narrow' }: Props) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex' }}>
      <NavRail />
      {/*
        `NavRail` is `position: fixed`, so it is out of flow and reserves no
        space of its own. This spacer is what actually holds the rail's
        column open. It replaces an `ml: { xs: 0, md: `${RAIL_WIDTH}px` }`
        on the pane below, which silently emitted only its `xs` rule — the
        `md` one never reached the stylesheet, so on desktop the pane (and
        the sticky app bar inside it) started at x=0 and ran underneath the
        rail, hiding the first destination's icon behind the bar. A flex
        spacer sized by `display` + `width` uses the same mechanism the rail
        and bottom bar already switch on, which does work here.
        See the design review, finding #01.
      */}
      <Box
        aria-hidden
        sx={{ display: { xs: 'none', md: 'block' }, width: `${RAIL_WIDTH}px`, flexShrink: 0 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {title && <TopBar title={title} action={action} backHref={backHref} width={width} />}
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
