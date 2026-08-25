# Chunk 15 — Navigation & responsive Material 3 shell

**Read first:** `docs/06-REDESIGN-PLAN.md` §4, `docs/04-DESIGN-SYSTEM.md`.
**Depends on:** 14. **Size:** M.

## Mission

Replace the three-tab, 680-px-column shell with a five-destination Material 3
shell that is mobile-first and genuinely usable on a desktop.

## 1. Routes

Create, move or redirect:

| New route | From | Notes |
|---|---|---|
| `/today` | new; hero extracted from `/plan` | default landing after unlock |
| `/program` | `/plan` (moved) | week-by-week block + routine list |
| `/program/builder` | new (chunk 18) | stub it here: a page that says "coming next" is fine |
| `/exercises` | new (chunk 17) | stub |
| `/history` | unchanged | |
| `/profile` | new (chunk 20) | stub, but move Settings under it now |
| `/profile/settings` | `/settings` (moved) | |

`/plan` → `/program` and `/settings` → `/profile/settings` become permanent
redirects in `next.config.ts`. `/` keeps its onboarding check but redirects to
`/today`.

## 2. The shell

Rewrite `src/components/AppShell.tsx` as a breakpoint-switching shell. One
source of truth for the destinations:

```ts
export const DESTINATIONS = [
  { label: 'Today',     href: '/today',     icon: <TodayIcon /> },
  { label: 'Program',   href: '/program',   icon: <CalendarMonthIcon /> },
  { label: 'Exercises', href: '/exercises', icon: <FitnessCenterIcon /> },
  { label: 'History',   href: '/history',   icon: <HistoryIcon /> },
  { label: 'Profile',   href: '/profile',   icon: <PersonIcon /> },
];
```

- **< 600 px** — `BottomNavigation`, fixed, `showLabels`, safe-area padding
  (already handled today; keep it).
- **600–899 px** — bottom navigation, content `maxWidth: 720`.
- **≥ 900 px** — MUI `Drawer variant="permanent"` styled as an M3
  **navigation rail** on the left (80 px, icon over label, active indicator
  pill), no bottom bar, content in a two-column grid where the page opts in.

Use `useMediaQuery(theme.breakpoints.up('md'))` — but render **both** and hide
with CSS (`display: { xs: 'flex', md: 'none' }`) rather than branching in JS, so
there is no hydration flash on first paint.

Prefetch + optimistic highlight from chunk 14 §2 applies to both.

## 3. Content width

Today every page is `maxWidth: 680`. On desktop that wastes the screen. Add a
`<PageContainer>` primitive:

```tsx
<PageContainer width="narrow" | "wide">
```

- `narrow` (default) → `maxWidth: 720`, for reading/forms/the player.
- `wide` → `maxWidth: 1200` with a responsive CSS grid
  (`repeat(auto-fill, minmax(320px, 1fr))`), for `/program`, `/exercises`,
  `/history` and `/profile`, which are list- and card-heavy.

## 4. Top app bar

Add a small M3 top app bar per page: title, optional back button (full-screen
routes only), optional action slot (e.g. search on `/exercises`, "+" on
`/program`). `AppBar` with `elevation={0}`, `color="transparent"`, and a
`position="sticky"` variant that gains `surfaceContainer` background on scroll.

## 5. Theme corrections

In `src/theme/theme.ts`:

- Add the missing M3 roles the design doc assumes and the code fakes with the
  ad-hoc `CONTAINER` export: `primaryContainer`/`onPrimaryContainer`,
  `secondaryContainer`, `tertiary`/`tertiaryContainer`, `surfaceContainerLow`,
  `surfaceContainer`, `surfaceContainerHigh`, `outlineVariant`. Expose them via
  `theme.vars` (`cssVariables` is already on) and delete `CONTAINER`.
- `TodayCard` and `NextBlockCard` currently use `primary.main` with
  `rgba(255,255,255,0.18)` chips. Move them to `primaryContainer` /
  `onPrimaryContainer` — correct M3, and it fixes the chips being illegible in
  light mode.
- Add a `MuiListItemButton` / `MuiCardActionArea` min-height of 48 px.
- Keep `defaultMode="system"`, but add a three-way theme toggle
  (system/light/dark) in `/profile/settings` persisted to `localStorage` via
  MUI's `useColorScheme`.

## 6. Session player chrome

`/session/[id]` is full-screen: no bottom nav, no rail. Give it its own top bar
with a back arrow, the session title, and the elapsed clock. The fixed "Finish
session" bar stays.

## Acceptance

- [ ] Five destinations, correct at every breakpoint, no hydration flash.
- [ ] Old `/plan` and `/settings` URLs redirect and do not 404.
- [ ] At 1440 px wide, `/program`, `/exercises`, `/history` and `/profile` use
      the width — multi-column, not a centred 680 px strip.
- [ ] No component reads the deleted `CONTAINER` export.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build` clean.

## Do not

- Do not build bespoke nav components where MUI has one.
- Do not put the session player behind a nav tab. Starting a session is an
  action from `/today`, not a destination.
