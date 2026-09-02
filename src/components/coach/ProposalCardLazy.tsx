'use client';
import Skeleton from '@mui/material/Skeleton';
import dynamic from 'next/dynamic';

/**
 * Same reason and shape as `MessageInputLazy.tsx` — chunk 29's own §2 named
 * this file alongside it as the pattern to reuse: `/coach/page.tsx` is a
 * Server Component and can render every plain chat bubble with zero client
 * JS, so only a message that actually carries a proposal needs to pay for
 * `ProposalCard`'s interactive Apply/Dismiss chrome, and it doesn't need to
 * be in the route's very first script to do it.
 */
export const ProposalCardLazy = dynamic(
  () => import('./ProposalCard').then((m) => m.ProposalCard),
  {
    ssr: false,
    loading: () => <Skeleton variant="rounded" height={96} sx={{ borderRadius: 3, maxWidth: '85%' }} />,
  },
);
