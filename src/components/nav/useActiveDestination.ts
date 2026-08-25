'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DESTINATIONS } from './destinations';

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
 */
export function useActiveDestination(): {
  active: string | false;
  onNavigate: (href: string) => void;
} {
  const pathname = usePathname();
  const fromPath = DESTINATIONS.find((d) => pathname.startsWith(d.href))?.href ?? false;

  const [pending, setPending] = useState<string | false>(false);
  useEffect(() => setPending(false), [pathname]);

  return { active: pending || fromPath, onNavigate: setPending };
}
