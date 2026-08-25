import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import TodayIcon from '@mui/icons-material/Today';
import type { ReactElement } from 'react';

export interface Destination {
  label: string;
  href: string;
  icon: ReactElement;
}

/**
 * The five-destination IA (docs/06-REDESIGN-PLAN.md §4). Single source of
 * truth for both the mobile bottom nav and the desktop navigation rail — they
 * render the same list, just laid out differently.
 */
export const DESTINATIONS: Destination[] = [
  { label: 'Today', href: '/today', icon: <TodayIcon /> },
  { label: 'Program', href: '/program', icon: <CalendarMonthIcon /> },
  { label: 'Exercises', href: '/exercises', icon: <FitnessCenterIcon /> },
  { label: 'History', href: '/history', icon: <HistoryIcon /> },
  { label: 'Profile', href: '/profile', icon: <PersonIcon /> },
];
