'use client';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Link from 'next/link';
import type { Destination } from './destinations';
import { useActiveDestination } from './useActiveDestination';

/** `destinations` comes from `AppShell` (server-side) — see NavRail's own note. */
export function BottomNav({ destinations }: { destinations: Destination[] }) {
  const { active, onNavigate } = useActiveDestination(destinations);

  return (
    <Paper
      component="nav"
      aria-label="Primary"
      elevation={0}
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
        borderTop: 1, borderColor: 'divider',
        pb: 'env(safe-area-inset-bottom)', bgcolor: 'background.paper',
      }}
    >
      <BottomNavigation
        value={active}
        onChange={(_, value) => onNavigate(value)}
        // MUI defaults to showing a label only on the selected tab — a
        // Material Design 2 holdover. M3's Navigation Bar spec shows every
        // destination's label at this item count (3–5); leaving it on the
        // default made four of five icons look unlabelled/unfinished.
        showLabels
        sx={{
          maxWidth: 720, mx: 'auto', bgcolor: 'transparent',
          // MUI gives every BottomNavigationAction `min-width: 80px`. Five
          // destinations therefore demand 400px, which does not fit a 390px
          // phone: the row overflowed by 10px, so "Today" sat flush against
          // the left edge with no gutter (its selected pill clipped) and
          // "Profile" ran off the right. Letting the items shrink lets the
          // five share the bar evenly and line up with the page's own
          // gutters instead of overhanging them.
          '& .MuiBottomNavigationAction-root': { minWidth: 0, px: 0.5 },
          px: 1,
        }}
      >
        {destinations.map((d) => {
          const selected = active === d.href;
          return (
            // A real <Link>, not router.push — gives Next's viewport prefetch,
            // so the destination is usually already fetched before the tap lands.
            <BottomNavigationAction
              key={d.href} label={d.label} value={d.href}
              // The desktop rail (NavRail.tsx) puts the selected icon on a
              // pill-shaped indicator — the actual M3 Navigation Bar/Rail
              // shape. Stock BottomNavigationAction only recolours the icon,
              // so without this the two surfaces disagreed on what
              // "selected" looks like.
              icon={
                <Box
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 56, height: 32, borderRadius: 999,
                    bgcolor: selected ? 'primary.main' : 'transparent',
                    color: selected ? 'primary.contrastText' : 'inherit',
                    transition: 'background-color 120ms ease',
                    '& svg': { fontSize: 22 },
                  }}
                >
                  {d.icon}
                </Box>
              }
              component={Link} href={d.href}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}
