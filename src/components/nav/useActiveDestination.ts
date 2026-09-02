'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Destination } from './destinations';

/**
 * Shared by the bottom nav and the navigation rail. A tap sets `pending`
 * synchronously so the destination highlights on the same frame as the
 * click — before the route has even started navigating — and the effect
 * below clears it the moment the real route lands, so the derived value
 * (from `usePathname`) takes back over with no visible handoff.
 *
 * This is the fix for "unresponsive menus": `router.push` gives neither
 * prefetch nor an immediate visual response, so every previous tap read as
 * dead until a full server round-trip finished. See chunk 14.
 *
 * Takes the destination list as an argument (chunk 25) rather than importing
 * `DESTINATIONS` itself — `AppShell` decides, server-side, whether "Coach"
 * belongs in it at all, and this hook has no business re-deciding that.
 */
export function useActiveDestination(destinations: Destination[]): {
  active: string | false;
  onNavigate: (href: string) => void;
} {
  const pathname = usePathname();
  const fromPath = destinations.find((d) => pathname.startsWith(d.href))?.href ?? false;

  const [pending, setPending] = useState<string | false>(false);
  useEffect(() => setPending(false), [pathname]);

  return { active: pending || fromPath, onNavigate: setPending };
}
