'use client';
import Skeleton from '@mui/material/Skeleton';
import dynamic from 'next/dynamic';

/**
 * Defers `MessageInput`'s own client weight (MUI `TextField`/`IconButton`,
 * chunk 29's biggest single win for `/coach`'s first-load JS — see
 * `docs/chunks/chunk-29-coach-guardrails.md §2`) out of the route's initial
 * bundle: `/coach/page.tsx` is a Server Component and renders the message
 * thread with zero client JS of its own, so only the input box needs to be
 * an interactive client island at all, and it doesn't need to be *in* the
 * very first script Next sends down.
 *
 * `next/dynamic`'s `ssr: false` cannot be called directly from a Server
 * Component (Next.js rejects it: "ssr: false is not allowed with
 * next/dynamic in Server Components") — this file's only job is to be the
 * Client Component boundary that makes it legal, the same way
 * `SessionPlayer.tsx` (itself already a client component) hosts its own
 * `ReadinessDialog`/`RestTimer`/`ListView` dynamic imports.
 */
export const MessageInputLazy = dynamic(
  () => import('./MessageInput').then((m) => m.MessageInput),
  {
    ssr: false,
    loading: () => <Skeleton variant="rounded" height={56} sx={{ borderRadius: 3 }} />,
  },
);
