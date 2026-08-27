/**
 * Nav geometry shared by the shell and the rail.
 *
 * Deliberately its own module with no `'use client'` directive. `RAIL_WIDTH`
 * used to live in `NavRail.tsx`, which is a client component, and `AppShell`
 * — a server component — imported it from there. Next.js turns every export
 * of a `'use client'` module into a client reference when a server component
 * imports it, so the *value* was not readable during the server render: the
 * `` `${RAIL_WIDTH}px` `` template in the shell resolved to an invalid length,
 * the browser dropped the declaration, and the rail's column silently
 * collapsed to zero. The desktop pane then started at x=0 and ran underneath
 * the fixed rail, putting the sticky app bar over the first destination's
 * icon. Nothing errored — the layout just quietly lost 88px.
 *
 * Keeping the constant in a plain module means both sides read the same
 * number. See the design review, finding #01.
 */
export const RAIL_WIDTH = 88;
