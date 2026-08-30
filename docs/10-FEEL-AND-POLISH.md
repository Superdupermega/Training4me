# 10 — FEEL AND POLISH

A design review of the app as it stands at commit `d259f84`, and the plan to
close what it found. Written for an agent to execute: chunks 22, 23 and 24 in
`docs/chunks/` are the executable briefs; this document is the *why*, the
shared rules that apply to all three, and the things deliberately left alone.

**Scope: this app is and stays single-athlete.** Nothing here adds accounts,
tenancy, billing or a legal surface — those were assessed separately and are
explicitly out of scope. Every item below is about how the app *feels* to the
one person who uses it.

---

## 1. Where the floor already is

Read this before concluding something is missing — a lot of the obvious
groundwork is done, and re-doing it is the main way this plan can be wasted.

- Full M3 token set in `src/theme/theme.ts`, including the `container` tones
  and three surface elevations MUI does not ship. Light **and** dark, driven
  by `cssVariables` — so `t.vars.palette.x.main` swaps live.
- Roboto Flex loaded via `next/font/google` in `src/app/layout.tsx`, exposed
  as `--font-sans`.
- `prefers-reduced-motion` handled **globally** in `src/theme/Providers.tsx`
  via a `GlobalStyles` block that flattens every animation and transition in
  the app. New animation does not need its own guard.
- `.tnum` (tabular numerals) class registered in `MuiCssBaseline`.
- 48px minimum touch targets enforced at theme level on `MuiButton`,
  `MuiListItemButton` and `MuiCardActionArea`.
- `env(safe-area-inset-bottom)` respected in `AppShell` and the player's
  fixed footer.
- Screen wake lock re-acquired on `visibilitychange` (`SessionPlayer.tsx`).
- Rest alert uses WebAudio **and** `navigator.vibrate`, because iOS Safari
  supports neither vibrate nor a reliable background interval
  (`src/components/session/restAlert.ts`).
- Charts are zero-JS SVG with a visually-hidden `<table>` fallback for
  screen readers (`src/components/charts/`).

## 2. What the review found

Grouped by how often you feel it. The chunk that fixes each is in the last
column.

| # | Finding | Where | Chunk |
|---|---|---|---|
| 1 | The player is a **planning** view being used as an **execution** view: six accordion blocks, ~20 collapsed rows, the set you are doing is one of them. There is no focus mode. | `src/components/session/SessionPlayer.tsx` | 22 |
| 2 | Logging a set produces `bgcolor: 'action.hover'` and a small tick. No haptic, no motion, no progress. It is the most repeated interaction in the app and it does not respond. | `src/components/session/SetRow.tsx` | 22 |
| 3 | The largest type token is `h1` at **1.75rem**. The running clock renders at `h3` (1.125rem), the weight field at `1.4rem`. `docs/04-DESIGN-SYSTEM.md` §2 specified `displaySmall` for the current weight, "must read from 1 m away" — it was never built. | `src/theme/theme.ts` | 22 |
| 4 | Finishing a block is a non-event. Training maxes roll over and nothing is shown. All the data for a retrospective already exists. | no such screen | 23 |
| 5 | A PR renders as a static `EmojiEventsIcon`. The gold `tertiary` role exists for exactly this and is otherwise used for one 4.5px dot. | `src/components/session/SessionSummary.tsx` | 23 |
| 6 | Charts have no x-axis labels, no gridlines, no area fill, no tap-to-inspect, no delta headline. Fixed 400×180 viewBox. | `src/components/charts/LineChart.tsx` | 23 |
| 7 | No body map. `volumeByMuscleGroup()` returns exactly the data; `MuscleCoverageStrip` renders coverage as chips, and only inside the builder. | `src/server/analytics.ts`, `src/components/builder/MuscleCoverageStrip.tsx` | 23 |
| 8 | `t4m_session.notes` exists in the schema. **Nothing writes or reads it.** | schema only | 23 |
| 9 | The rest timer does not show what is next, cannot go full-screen, and cannot reach you if you leave the app — despite a service worker and web push already being wired. | `src/components/session/RestTimer.tsx` | 24 |
| 10 | Every block renders identically. Primer, main lift, superset and down-regulate share one overline and one card. | `src/components/session/SessionPlayer.tsx` | 24 |
| 11 | Plate math is a text string. `plateBreakdown()` already returns structured per-side data. | `src/core/plates.ts`, `SetRow.tsx` | 24 |
| 12 | No empty-state art anywhere — `EmptyChart`, `/offline`, `not-found` are bare text. | several | 24 |
| 13 | 286 exercises, zero visuals of any kind, including in the picker. | `src/components/exercises/` | 24 |
| 14 | `consistency()` is computed and only shown on a profile tab, never on `/today`. | `src/app/today/page.tsx` | 24 |
| 15 | Ramp sets render as faded rows labelled "Ramp". There is no warm-up ladder view. | `SetRow.tsx` | 24 |
| 16 | Heatmap cells are 12px — below a comfortable tap target, and not interactive anyway. | `src/components/charts/Heatmap.tsx` | 24 |

## 3. Rules that apply to every chunk

These are the ways this codebase breaks. Read them once; they are not
repeated in each brief.

1. **`src/core` stays pure.** No React, no Supabase, no `window`, no
   `Date.now()` that isn't passed in. `eslint.config.mjs` enforces the
   Supabase half with `no-restricted-imports`; the rest is convention that
   `pnpm lint` will not catch for you. New pure logic (a plate layout
   calculator, a retrospective aggregator) belongs in `src/core`; anything
   touching the DOM does not.
2. **Use `t.vars.palette.x.main`, never `theme.palette.x.main`,** inside a
   `styleOverrides` callback or any style computed once. The latter is baked
   to one scheme's literal hex at stylesheet-generation time and will not
   swap in dark mode. `theme.ts`'s `MuiChip` override carries a comment
   explaining exactly this; it is the single most repeated bug in this
   codebase's history.
3. **Every mutating server action calls `await requireUnlocked()` first**,
   as its first statement. Next.js exposes each one as a public endpoint
   regardless of middleware.
4. **`/unlock` must not import from `src/server/actions.ts`**, directly or
   transitively through any component it renders. `pnpm verify:actions`
   checks this and must pass. If you add an action, put it in `actions.ts`
   or `routines.ts`, never in a module `/unlock` can reach.
5. **Do not add an animation guard.** `Providers.tsx` already flattens
   everything under `prefers-reduced-motion`. Adding a second mechanism is
   how it drifts.
6. **`minWidth: 0` on flex children is load-bearing**, not tidiness. See the
   comment in `SetRow.tsx`'s `Stepper` — a bare `<input>` reports a 20-char
   intrinsic width and pushed the entire weight control off-screen on every
   phone. Any new flex row containing an input needs the same.
7. **The outbox key is `sessionId:blockLetter:slot:setNumber`** in both
   `enqueue()` and `drain()`, and the server upsert is keyed on
   `(session, block, slot, set)`. Offline replay idempotency depends on
   both agreeing. Do not touch either without reading
   `src/components/session/outbox.ts` in full.
8. **Respect the per-route first-load JS budgets** from
   `docs/chunks/chunk-21-polish.md` §4:

   | Route | Budget (gzip) |
   |---|---|
   | `/today` | ≤ 130 kB |
   | `/exercises` | ≤ 160 kB |
   | `/program/builder` | ≤ 190 kB |
   | `/session/[id]` | ≤ 170 kB |

   `/session/[id]` is the one under pressure and the one chunk 22 touches
   most. `ReadinessDialog` and `RestTimer` are already `next/dynamic` with
   `ssr: false` to keep it under. **A blown budget is a finding to report,
   not a number to edit.** If focus mode cannot fit, split it out the same
   way and say so.
9. **Prefer SVG over a charting library.** Every chart in this app is
   hand-rolled SVG with zero client JS and an accessible table fallback.
   Adding Recharts or similar to get an area fill would cost more than the
   whole feature is worth and would break the zero-JS property. Keep it.
10. **`pnpm test && pnpm lint && pnpm typecheck && pnpm build` must be clean
    before you push.** 324 tests pass today; that number only goes up.
11. **Append to `docs/PROGRESS.md`** in the existing format after each
    chunk, and record any deviation from the brief in `docs/DECISIONS.md`
    with the reason. Do not silently drop an item — an item you decided
    against is a `DECISIONS.md` entry, not an omission.

## 4. Deliberately not doing

Recorded so a later agent does not "fix" them.

- **Forcing dark mode in the session player.** `docs/04-DESIGN-SYSTEM.md` §2
  says "dark is the default in the session player (gyms are dark, phones are
  bright)". `Providers.tsx` uses `defaultMode="system"` app-wide. Overriding
  the scheme on one route means a visible flash on navigation into and out
  of the player and a theme that disagrees with itself. If this is wanted it
  belongs as a *setting*, not a route-scoped override. Left alone.
- **`src/theme/tokens.ts`.** §1 of the design system doc specifies semantic
  aliases (`tierMain`, `readinessGood/ok/low`) in a separate module. The
  palette extension in `theme.ts` already covers every use these would have
  had, and a second naming layer over the same colours is one more thing to
  keep in sync. Not building it.
- **Licensed exercise video or photography.** Out of scope for a personal
  app. Chunk 24 adds *pattern glyphs*, which are drawable and carry no
  licence.
- **A charting dependency.** See rule 9.
- **Anything touching auth, tenancy, billing, or a `user_id` column.** Out
  of scope, permanently, for this plan.

## 5. Order and why

**22 → 23 → 24**, and the order matters.

Chunk 22 is the only one you feel on every single set, and it establishes
the type scale and motion vocabulary the other two build on — doing 23 first
means restyling it afterwards. Chunk 23 is the payoff loop: it makes eight
weeks of logging worth looking at, and it needs 22's `display` variants to
render its numbers. Chunk 24 is a bag of independent craft items with no
ordering between them; it can be split across sessions freely, or cherry-
picked, without breaking anything.

Each chunk ends green, committed and pushed to `main`, per the convention
every prior chunk followed.

## 6. One documentation defect found on the way

Not part of any chunk, but an agent reading `README.md` to orient itself will
be misled, so it is recorded here.

`README.md` still describes the database as wide open — *"with the publishable
key, each policy is currently `USING (true)` for both `anon` and
`authenticated`"* — and presents **The trade-off, stated plainly** as an
outstanding decision. That has not been true since 2026-08-26.
`docs/08-RLS-TIGHTENING.md` was applied, and `pg_policies` on the live project
confirms all 14 `t4m_` tables now carry exactly one `service_role`-only policy
each, with no `anon`/`authenticated` grant anywhere.

The README is therefore wrong about the app's own security posture in two
places. Fix it whenever you are next in that file; do not repeat the old claim
in anything you write.
