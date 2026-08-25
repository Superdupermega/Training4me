'use client';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { RegisterServiceWorker } from '@/components/RegisterServiceWorker';
import { theme } from './theme';

// MUI's Collapse, Fade, Grow, page-transition highlights, etc. all animate
// via plain CSS transitions/animations, so a single global media query is
// enough to honour prefers-reduced-motion everywhere at once, rather than
// threading a `reduceMotion` flag through every component that animates.
const reducedMotion = {
  '@media (prefers-reduced-motion: reduce)': {
    '*, *::before, *::after': {
      animationDuration: '0.01ms !important',
      animationIterationCount: '1 !important',
      transitionDuration: '0.01ms !important',
      scrollBehavior: 'auto !important',
    },
  },
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline />
        <GlobalStyles styles={reducedMotion} />
        <RegisterServiceWorker />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
