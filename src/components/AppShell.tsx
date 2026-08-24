'use client';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

const TABS = [
  { label: 'Plan', value: '/plan', icon: <CalendarMonthIcon /> },
  { label: 'History', value: '/history', icon: <HistoryIcon /> },
  { label: 'Settings', value: '/settings', icon: <SettingsIcon /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = TABS.find((t) => pathname.startsWith(t.value))?.value ?? false;

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
          onChange={(_, value) => router.push(value)}
          sx={{ maxWidth: 680, mx: 'auto', bgcolor: 'transparent' }}
        >
          {TABS.map((tab) => (
            <BottomNavigationAction key={tab.value} label={tab.label} value={tab.value} icon={tab.icon} />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
