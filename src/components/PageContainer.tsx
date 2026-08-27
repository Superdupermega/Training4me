import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

/**
 * The two content column widths, exported so the shell's top bar can sit on
 * the *same* grid as the page under it. They used to disagree — the toolbar
 * hardcoded 1200 while a narrow page's content was 720, which put the app
 * bar's title 224px to the left of the `<h1>` directly beneath it on a
 * 1440px screen. See the design review, finding #04.
 */
export const CONTENT_WIDTH = { narrow: 720, wide: 1200 } as const;

export type ContentWidth = keyof typeof CONTENT_WIDTH;

interface Props {
  children: ReactNode;
  /**
   * `narrow` (default) — a single reading column, 720px, for forms and
   * anything the player-style content lives in.
   * `wide` — up to 1200px with a responsive card grid, for list- and
   * card-heavy pages (`/program`, `/exercises`, `/history`, `/profile`) that
   * otherwise waste a desktop-sized screen sitting in a phone-width column.
   */
  width?: ContentWidth;
  /** Opt out of the grid layout on a `wide` page that wants its own layout. */
  grid?: boolean;
}

export function PageContainer({ children, width = 'narrow', grid = width === 'wide' }: Props) {
  if (width === 'wide') {
    return (
      <Box sx={{ maxWidth: CONTENT_WIDTH.wide, mx: 'auto' }}>
        {grid ? (
          <Box
            sx={{
              display: 'grid',
              // `minmax(0, …)` on both tracks for the same reason the week
              // grid on /program needs it: a `1fr` track's implicit minimum
              // is min-content, so one `noWrap` string inside a card can
              // push the whole column wider than the screen.
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            {children}
          </Box>
        ) : (
          children
        )}
      </Box>
    );
  }
  return <Box sx={{ maxWidth: CONTENT_WIDTH.narrow, mx: 'auto' }}>{children}</Box>;
}
