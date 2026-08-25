'use client';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Link from 'next/link';
import { DESTINATIONS } from './destinations';
import { useActiveDestination } from './useActiveDestination';

export function BottomNav() {
  const { active, onNavigate } = useActiveDestination();

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
        sx={{ maxWidth: 720, mx: 'auto', bgcolor: 'transparent' }}
      >
        {DESTINATIONS.map((d) => {
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
