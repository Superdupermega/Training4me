'use client';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
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

/**
 * No monitoring existed at all — no analytics, no performance data, no error
 * reporting, no uptime check. If the app started 500ing there was no way to
 * find out except trying to train and hitting it. Analytics/Speed Insights
 * are two lines each and Vercel's own first-party tooling — the natural
 * floor for a Vercel-hosted app with no monitoring at all. Error reporting
 * proper (Sentry or similar) is a larger, separate call the review flagged
 * but left to the app owner, now that error.tsx/global-error.tsx (#20) give
 * it somewhere real to report from. See docs/07-PRODUCTION-REVIEW.md #26.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline />
        <GlobalStyles styles={reducedMotion} />
        <RegisterServiceWorker />
        {children}
        <Analytics />
        <SpeedInsights />
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
