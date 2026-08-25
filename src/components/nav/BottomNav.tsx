'use client';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
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
        sx={{ maxWidth: 720, mx: 'auto', bgcolor: 'transparent' }}
      >
        {DESTINATIONS.map((d) => (
          // A real <Link>, not router.push — gives Next's viewport prefetch,
          // so the destination is usually already fetched before the tap lands.
          <BottomNavigationAction
            key={d.href} label={d.label} value={d.href} icon={d.icon}
            component={Link} href={d.href}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
