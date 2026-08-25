import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /**
   * `narrow` (default) — a single reading column, 720px, for forms and
   * anything the player-style content lives in.
   * `wide` — up to 1200px with a responsive card grid, for list- and
   * card-heavy pages (`/program`, `/exercises`, `/history`, `/profile`) that
   * otherwise waste a desktop-sized screen sitting in a phone-width column.
   */
  width?: 'narrow' | 'wide';
  /** Opt out of the grid layout on a `wide` page that wants its own layout. */
  grid?: boolean;
}

export function PageContainer({ children, width = 'narrow', grid = width === 'wide' }: Props) {
  if (width === 'wide') {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        {grid ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(320px, 1fr))' },
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
  return <Box sx={{ maxWidth: 720, mx: 'auto' }}>{children}</Box>;
}
