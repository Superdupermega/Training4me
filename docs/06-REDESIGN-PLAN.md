# 06 — REDESIGN PLAN (v2)

**Status:** ready to execute. **Author:** planning session, 2026-08-25.
**Audience:** the implementing agent (Sonnet). Read this file top to bottom
before touching code, then run the chunks in `docs/chunks/chunk-14…21` in order.

The app works but it is the wrong shape. v1 is a *program generator that logs*.
The user wants a *training app you can own*, in the mould of StrengthLog: fast
menus, a real exercise database browsable by muscle, a program you build
yourself, and a serious analysis view. This plan turns v1 into that without
throwing away the training engine, which is the best part of the codebase.

---

## 1. What the user asked for, verbatim → what it means here

| Ask | Reading | Chunk |
|---|---|---|
| "Material design for mobile first, but can work on desktop too" | Keep MUI/M3. Add a responsive shell: bottom nav < 900 px, navigation rail ≥ 900 px, content grid that uses the width instead of a 680 px column on a 1440 px screen. | 15 |
| "All menus needs to make sense" | The IA is wrong, not just slow. Three tabs (Plan/History/Settings) cannot hold a builder, a library and an analysis view. New five-destination IA in §4. | 15 |
| "I want it to be like the app StrengthLog" | Logging-first, exercise-database-first, own-your-program. Concretely: exercise browser with per-exercise history, routine builder, per-exercise charts, PR list, rest timer, plate calculator. | 16–20 |
| "I want to be able to add and build my program myself" | A routine builder that produces the same `t4m_session.blocks` JSONB the generator produces, so the session player is untouched. Plus custom exercises. | 18 |
| "Extensive exercise list for each muscle group" | The library has 93 movements tagged by *movement pattern* only — there is no muscle-group axis at all, so "browse by muscle group" is currently impossible. Add a muscle taxonomy and grow to ~300 movements. | 16 |
| "Marcus Filly exercises as a part of the list" | Tag a `functional_bodybuilding` style flag and add ~50 movements characteristic of that style (dual-KB front rack work, tempo ring rows, bottoms-up presses, Zercher/sandbag, sled, carries, Copenhagen/Nordic). | 16 |
| "Very unresponsive when clicking in the menus" | Diagnosed in §2. It is four compounding causes, three of them one-line fixes. This is chunk 14 and it ships first. | 14 |
| "Log and data analysis page super advanced but user-friendly (can be in the profile page)" | `/profile` becomes the analysis home: trends, volume, muscle balance, per-lift e1RM, consistency, plus the settings that live there today. | 20 |
| "When I choose an exercise… see what I did last time for that same exercise OR what is expected given my 1RM" | One server function, `exerciseContext(ids)`, surfaced in three places: exercise picker, builder item editor, session player. | 19 |

---

## 2. Why the menus feel dead — diagnosis

Four causes, compounding. Measured against the code as it stands.

**(a) The bottom nav does not prefetch and gives no feedback.**
`src/components/AppShell.tsx` renders `BottomNavigation` with
`onChange={(_, value) => router.push(value)}`. `router.push` does **not**
prefetch — only `next/link` does. And the selected tab is derived from
`usePathname()`, which does not change until the navigation *commits*. So a tap
produces: nothing on screen → cold server render → everything at once. The tab
you pressed does not even highlight. This alone reads as "broken".

**(b) Every route is `dynamic = 'force-dynamic'` with no `loading.tsx`.**
`/plan`, `/history`, `/settings`, `/session/[id]` and `/` all opt out of every
cache, and there is not a single `loading.tsx` in `src/app`. With no Suspense
boundary, Next holds the old page until the new server render is fully done.

**(c) Serial Supabase round-trips, from the wrong continent.**
`/plan` awaits `getProfile()`, then `getActiveProgram()`, then
`listSessions()` — three sequential round-trips, each building a *new* Supabase
client (`db()` calls `createClient` on every call). The Supabase project
`cyberpunk-vibe01` is in **`eu-north-1` (Stockholm)**; the Vercel project
`training4me` is on Hobby with no `vercel.json`, so functions run in the default
**`iad1` (Washington DC)**. That is ~90–110 ms each way, ~200 ms per query,
~600 ms of pure network on `/plan` before any rendering happens.

**(d) Edge middleware on every request.** `src/middleware.ts` matches nearly
everything, including RSC payload fetches, and does a SHA-256 per request. Cheap
in isolation, but it adds an Edge hop in front of an already-slow render.

Fix order matters: (a) and (b) change what the user *sees* within 50 ms; (c) is
the biggest raw-latency win and is a two-line `vercel.json` plus `Promise.all`.

---

## 3. Architectural spine — do not break this

The one thing v1 got right, and everything below depends on it:

> **`t4m_session.blocks` (JSONB, shape `SessionBlock[]`) is the runtime
> contract.** The session player consumes it; the generator produces it.

The builder becomes a **second producer of the same shape**. It does not get its
own player, its own set-logging path, or its own progression code. Concretely:

```
generator  ─┐
            ├─→  SessionBlock[]  ─→  t4m_session.blocks  ─→  SessionPlayer
builder    ─┘                                             └─→  t4m_logged_set
```

Two rules that follow, and that the chunks enforce:

1. `src/core` stays pure — no React, no DB, no unseeded randomness. There is a
   lint rule for it. The builder's materialiser (`routine → SessionBlock[]`)
   belongs in `src/core/builder/`, not in `src/server`.
2. **The 150-combination matrix test (`src/core/generator/matrix.test.ts`) must
   stay green after every chunk.** It is the reason to trust the engine. If a
   change to the library or types breaks it, the change is wrong.

---

## 4. Target information architecture

Five destinations. Bottom nav on mobile, `NavigationRail` ≥ 900 px, same routes.

| # | Route | Icon | What lives there |
|---|---|---|---|
| 1 | `/today` | `TodayIcon` | Today's session (or next), start/continue, this week's strip, quick "log an empty workout". The current `/plan` hero, narrowed to *today*. |
| 2 | `/program` | `CalendarMonthIcon` | The active block week-by-week; list of routines; **Build a program** → `/program/builder`; swap between generated and custom. |
| 3 | `/exercises` | `FitnessCenterIcon` | The library: search, filter by muscle group / equipment / style, favourites. `/exercises/[id]` = detail + your history + chart + PRs. |
| 4 | `/history` | `HistoryIcon` | Finished sessions feed + calendar heatmap. Tap a session → read-only replay of what you actually logged. |
| 5 | `/profile` | `PersonIcon` | **Analysis home** (§ chunk 20), PRs, training maxes, body metrics, and settings behind a sub-route `/profile/settings`. |

Routes that are *not* destinations (no nav entry, full-screen, own back button):
`/session/[id]` (the player), `/program/builder`, `/onboarding`, `/unlock`.

Redirects to keep old links alive: `/plan` → `/program`, `/settings` →
`/profile/settings`.

**Why five and not three:** the user's asks are four different jobs (do today's
session / shape the program / look something up / understand the data). Each
needs a home or it ends up buried, which is the current complaint.

---

## 5. Execution order

Ship in this order. Each chunk is independently deployable and leaves the app
working. Do not start a chunk before the previous one is green.

| Chunk | Name | Size | Why here |
|---|---|---|---|
| **14** | Performance & responsiveness | S | The loudest complaint, the cheapest fix. Ship first so every later chunk is judged on a fast app. |
| **15** | Navigation & responsive M3 shell | M | Creates the routes everything else hangs off. |
| **16** | Exercise library: muscle taxonomy + expansion + Filly set | L | Pure data + types. Blocks 17, 18, 19. |
| **17** | Exercise browser & detail pages | M | First payoff from 16. |
| **18** | Program builder | L | The biggest feature. Needs 15 (routes), 16 (library), 17 (picker). |
| **19** | "Last time / expected" exercise context | S | Small, high-value, threads through 17, 18 and the player. |
| **20** | Profile: log & data analysis | L | Needs real logged data to be worth anything; also the most self-contained. |
| **21** | Polish, a11y, PWA, docs | M | Close-out. |

---

## 6. Risks and how each is contained

| Risk | Containment |
|---|---|
| **Growing the library changes every generated program**, because `find()` selects across the whole of `EXERCISES`, and volume bands / balance rules were tuned against 93 movements. | Add `inGeneratorPool?: boolean` to `Exercise`. `query.find()` filters `ex.inGeneratorPool !== false`. Every movement added in chunk 16 ships `inGeneratorPool: false` — visible in the browser and the builder, invisible to the generator. Opt individual ones in later, deliberately, one at a time, re-running the matrix. |
| **The banned-word test** (`exercises.test.ts` → `'snatch','clean','muscle-up','kipping','handstand','pistol'`) blocks legitimate FB movements the user may want to program by hand. | Do not delete the rule — it exists so the *generator* never prescribes a skill lift unsupervised. Replace it: add `skillGated: true` to those movements, assert in the test that every `skillGated` movement is `complexity: 'advanced'` **and** `inGeneratorPool: false`. The user can still pick them in the builder. |
| **Builder-authored sessions could bypass time budget / balance and produce nonsense.** | The builder does not run the balance repair loop. It *does* run `estimateSession` from `src/core/timeBudget.ts` and shows the estimate live, plus non-blocking advisory warnings (see chunk 18 §6). The user's plan is the user's plan — warn, never overrule. |
| **Adding charts blows the bundle**, undoing chunk 14. | No charting library. Hand-rolled SVG primitives in `src/components/charts/` — the datasets are one person's training log, a few hundred points at most. Budget in chunk 21: first-load JS for `/today` ≤ 130 kB gzipped. |
| **Schema drift.** `docs/02-DATA-MODEL.md` describes a multi-user, fully-normalised schema that was never built; the live schema is single-user `t4m_*` with JSONB blocks. | Chunk 21 rewrites `02-DATA-MODEL.md` to describe what actually exists. Until then, trust the live schema (dumped in §7), not that document. |
| **Zero logged sets today** (`t4m_logged_set` is empty), so the analysis view has nothing to render. | Every chart ships a designed empty state, and chunk 20 includes a seed script (`scripts/seed-demo-log.ts`, dev-only, behind an explicit flag) so the views can be built and reviewed. |

---

## 7. Live schema, as of 2026-08-25

Trust this over `02-DATA-MODEL.md`. Project `evlxbewvsgrlncvtagmf`
(`cyberpunk-vibe01`, `eu-north-1`), all tables prefixed `t4m_`.

| Table | Rows | Notes |
|---|---|---|
| `t4m_profile` | 1 | single row, `id = 'me'` |
| `t4m_program` | 1 | partial unique index: one `status='active'` |
| `t4m_session` | 18 | `blocks jsonb`, unique `(program_id, week_number, day_number)` |
| `t4m_logged_set` | 0 | unique `(session_id, block_letter, slot, set_number)` — this is what makes offline replay idempotent |
| `t4m_training_max` | 3 | unique `(exercise_id, effective_from)` |
| `t4m_pr` | 0 | |
| `t4m_pain_flag` | 0 | |

Every table: RLS enabled, one policy `<table>_app` — `FOR ALL TO anon,
authenticated USING (true) WITH CHECK (true)`. New tables must follow exactly
this pattern or the publishable key cannot reach them.

---

## 8. Definition of done for the whole plan

- [x] Tapping any nav item paints feedback in < 100 ms and the destination in
      < 500 ms on a mid-range phone over 4G. *(Optimistic highlight is
      synchronous — chunk 15's `useActiveDestination` — and every destination
      is prefetched on hover/viewport-enter, chunk 14. Actual on-device
      timing over a real 4G connection was never observable in this sandbox
      — no phone, no throttled network — so this is verified by mechanism,
      not by a stopwatch.)*
- [x] Bottom nav on mobile, navigation rail on desktop, no 680 px column on a
      wide screen.
- [x] Every muscle group has a browsable list; ~300 movements; ≥ 50 tagged
      `functional_bodybuilding`. *(286 total, 63 `functional_bodybuilding`,
      101 generator-pool-eligible — verified by direct import, chunk 16.)*
- [x] A program can be built from scratch — days, exercises, sets, reps, tempo,
      rest, supersets — scheduled, and played in the existing session player.
- [x] Picking an exercise anywhere shows last-time performance and/or the
      TM-derived expected load.
- [x] `/profile` answers: am I getting stronger, am I training enough, is
      anything unbalanced, what are my records.
- [x] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` all clean.
      The 150-combination matrix is still green.

## 9. Performance budget

The chunk 14 diagnosis (§2) was that the old app felt unresponsive; chunk
14's fixes (prefetching, `unstable_cache`, tag-scoped revalidation, a
memoized DB client and PIN token) addressed the *cause*. This table is the
one number that would catch a regression sneaking back in through a later
chunk — every route's First Load JS, gzipped, as reported by `next build`.
Chunk 21 §4 named four explicit targets; the rest below are this table's own
extrapolation from those four (marked), not separately specified anywhere.

| Route | Budget | Actual (end of chunk 21) | Over? |
|---|---|---|---|
| `/today` | 130 kB | 164 kB | yes, by 34 kB |
| `/exercises` | 160 kB | 214 kB | yes, by 54 kB |
| `/program/builder` | 190 kB | 193 kB | yes, by 3 kB |
| `/session/[id]` | 170 kB | 232 kB | yes, by 62 kB |
| `/program` *(extrapolated)* | 150 kB | 164 kB | yes |
| `/program/builder/[id]` *(extrapolated)* | 220 kB | 246 kB | yes |
| `/exercises/[id]` *(extrapolated)* | 150 kB | 159 kB | yes |
| `/history` *(extrapolated)* | 150 kB | 158 kB | yes |
| `/profile` *(extrapolated)* | 180 kB | 191 kB | yes |
| `/profile/settings` *(extrapolated)* | 190 kB | 201 kB | yes |
| `/onboarding` *(extrapolated)* | 190 kB | 194 kB | yes |
| shared (every route pays this floor) | — | 102 kB | — |

**Every named route is over budget.** Recorded honestly rather than
adjusted to make the table green, per chunk 21 §4's own instruction ("a
finding to report, not a number to edit") — this is that finding, not a
number this chunk retroactively hit by redefining it. The shared floor
alone (MUI's emotion runtime + the App Router client runtime) is 102 kB —
already most of `/today`'s entire 130 kB budget before that route's own code
runs at all. That floor rose once, at chunk 15 (the M3 palette module
augmentation and the always-mounted `NavRail`/`BottomNav` shell landing on
every route), and has held flat since; it was never revisited afterward
against the target set before it existed. `/exercises` and `/session/[id]`
are the two largest misses and the two obvious next-chunk candidates: the
former for a route-level code-split of `ExerciseBrowser`'s filter chips off
the initial bundle, the latter for auditing what `SessionPlayer.tsx`
actually needs eagerly versus what could lazy-load behind the rest-timer
and readiness-dialog code paths. Neither was attempted here — chunk 21 is
close-out, and a speculative bundle-splitting change with no later chunk
left to catch a regression from it is a worse trade than reporting the
number plainly.
