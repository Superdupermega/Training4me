'use client';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

const TABS = [
  { label: 'Plan', value: '/plan', icon: <CalendarMonthIcon /> },
  { label: 'History', value: '/history', icon: <HistoryIcon /> },
  { label: 'Settings', value: '/settings', icon: <SettingsIcon /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fromPath = TABS.find((t) => pathname.startsWith(t.value))?.value ?? false;

  // The tap must highlight before the navigation commits, or the bottom bar
  // reads as broken — the exact "unresponsive menu" complaint this fixes.
  // `pending` is set synchronously on click, so the pressed tab lights up on
  // the same frame; once the real route lands, `pathname` changes and the
  // effect below clears it, so the derived `fromPath` takes back over with no
  // visible handoff.
  const [pending, setPending] = useState<string | false>(false);
  useEffect(() => setPending(false), [pathname]);
  const current = pending || fromPath;

  return (
    <Box sx={{ minHeight: '100dvh', pb: 'calc(72px + env(safe-area-inset-bottom))' }}>
      <Box sx={{ maxWidth: 680, mx: 'auto', px: 2, pt: 2 }}>{children}</Box>
      <Paper
        component="nav"
        elevation={0}
        sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
          borderTop: 1, borderColor: 'divider',
          pb: 'env(safe-area-inset-bottom)', bgcolor: 'background.paper',
        }}
      >
        <BottomNavigation
          value={current}
          onChange={(_, value) => setPending(value)}
          sx={{ maxWidth: 680, mx: 'auto', bgcolor: 'transparent' }}
        >
          {TABS.map((tab) => (
            <BottomNavigationAction
              key={tab.value}
              label={tab.label}
              value={tab.value}
              icon={tab.icon}
              // A real <Link>, not router.push in the handler above — this is
              // what gives Next's viewport prefetch, so the destination's
              // payload is usually already on the device before the tap lands.
              component={Link}
              href={tab.value}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
