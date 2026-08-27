'use client';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { DESTINATIONS } from './destinations';
import { RAIL_WIDTH } from './layout';
import { useActiveDestination } from './useActiveDestination';

/**
 * MUI has no packaged M3 navigation rail, so this is built from primitives:
 * icon over label, a pill-shaped active indicator behind the icon, fixed to
 * the left edge at ≥ 900 px. Rendered unconditionally and hidden with CSS
 * (not branched in JS) so there is no hydration flash on first paint.
 */
export function NavRail() {
  const { active, onNavigate } = useActiveDestination();

  return (
    <Box
      component="nav"
      aria-label="Primary"
      sx={{
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        alignItems: 'center',
        width: RAIL_WIDTH, flexShrink: 0,
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 10,
        pt: 3, gap: 1,
        borderRight: 1, borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {DESTINATIONS.map((d) => {
        const selected = active === d.href;
        return (
          <Stack
            key={d.href}
            component={Link}
            href={d.href}
            onClick={() => onNavigate(d.href)}
            spacing={0.5}
            sx={{
              alignItems: 'center', width: 64, py: 0.75, borderRadius: 3,
              textDecoration: 'none', color: selected ? 'primary.main' : 'text.secondary',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
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
            <Typography variant="caption" sx={{ fontWeight: selected ? 700 : 500, fontSize: '0.7rem' }}>
              {d.label}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
}
