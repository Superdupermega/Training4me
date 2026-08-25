# PROGRESS

The hand-off log between chunks. Read at the start of every session, appended at
the end of every session. Keep entries short — this file must stay cheap to read.

Format:

```
## Chunk NN — <name> — YYYY-MM-DD
**Landed:** what now exists.
**Deviated:** anything that differs from the plan, and why.
**Next chunk must know:** gotchas, decisions, names to reuse.
**Blocked:** anything unfinished (empty if none).
```

---

## Chunk 00 — Plan — 2026-08-23
**Landed:** The full build plan: context, methodology spec, data model,
architecture, design system, roadmap, runbook and 13 chunk prompts.
**Deviated:** —
**Next chunk must know:** The repo is otherwise empty; chunk 01 initialises the
Next.js app at the repo root and must not clobber `docs/`.
**Blocked:** Supabase project must be created by the user before chunk 02.

## Built in full — 2026-08-24
**Landed:** The whole app, not just the plan. Chunks 01-11 of the roadmap are
done in one pass: scaffold, training engine, database, server layer, onboarding,
plan views, session player, history and settings.

**Deviated:** Several, all recorded in `DECISIONS.md`. The largest: single
athlete so there is no auth (PIN gate + service-role access behind RLS with no
policies); later weeks re-materialise from week one rather than being generated
independently; balance ratios are validated on the template week and invariants
on the rest; the exercise library lives in TypeScript rather than being seeded
into Postgres, since only this app reads it.

**Verified:** 206 tests green, including the 150-combination matrix. Schema
round-trips real generated sessions. Replaying an offline log queue twice leaves
one row per set. The `anon` role sees zero rows and cannot insert. Lint,
typecheck and build all clean. Dev server boots and the PIN gate redirects.

**Not verified:** the live runtime against Supabase, because the service-role
key is not available in this environment. First run after adding it to
`.env.local` will exercise it.

**Blocked:** Vercel project creation returns 403 from this session's Vercel
connection, so the project has to be imported once by hand — steps are in the
README. After that, pushes deploy automatically.

## Chunk 14–21 — Redesign plan — 2026-08-25
**Landed:** `docs/06-REDESIGN-PLAN.md` plus eight chunk files (14–21) covering
performance, a five-destination Material 3 shell, the muscle taxonomy and
library expansion, the exercise browser, the program builder, exercise context
("last time / expected"), the analysis view, and close-out polish. No code
changed.

**Diagnosed:** the "unresponsive menus" complaint is four compounding causes —
`router.push` in the bottom nav (no prefetch, no optimistic highlight), no
`loading.tsx` anywhere against `force-dynamic` routes, serial Supabase queries,
and Vercel functions in `iad1` against a Supabase project in `eu-north-1`.
Full write-up in `06-REDESIGN-PLAN.md` §2; fixes in chunk 14.

**Next chunk must know:**
- `t4m_session.blocks` (JSONB) is the runtime contract. The builder is a second
  producer of that shape, not a second player.
- Growing the exercise library would silently reshape every generated program.
  Chunk 16 adds `inGeneratorPool` and a tripwire test pinning the pool at 93.
- `docs/02-DATA-MODEL.md` describes a schema that was never built. The live
  schema is dumped in `06-REDESIGN-PLAN.md` §7; chunk 21 rewrites the doc.
- Six known defects are listed in `chunk-21-polish.md` §1.

**Blocked:** nothing. Run chunk 14 first.

## Chunk 14 — Performance & responsiveness — 2026-08-25
**Landed:** Every fix from `chunk-14-performance.md` except the bundle-analyzer
run (no `ANALYZE` script added; numbers below are read straight from the
`next build` route table instead, which reports the same first-load JS
figures).

- `vercel.json` pins the `arn1` (Stockholm) region, next to the Supabase
  project, instead of Vercel's Hobby default `iad1` (Washington DC).
- `AppShell`'s bottom nav now renders real `next/link`s (viewport prefetch)
  and highlights the tapped tab from local state set synchronously on click,
  reconciled against the real pathname once navigation commits — no more
  dead tap before a full server round-trip.
- `loading.tsx` added for `/plan`, `/history`, `/settings`, `/session/[id]`,
  each rendering a page-shaped `Skeleton` from the new
  `src/components/skeletons/`.
- `db()` in `src/server/db.ts` now returns a memoised client instead of
  constructing one per call.
- Every read in `src/server/repo.ts` is wrapped in `unstable_cache`, tagged
  `profile` / `program` / `sessions` / `logs`; every mutation in
  `src/server/actions.ts` now calls `revalidateTag` for what it touched,
  replacing the old `revalidatePath` calls.
- `/plan` fetches profile and program in parallel instead of serially, and
  `/session/[id]` skips the logged-sets query entirely for an already-completed
  session (it returns before ever needing `initialLogged`).
- `src/middleware.ts`: the derived PIN token is cached per Edge isolate
  instead of re-hashed every request; the matcher now excludes all of
  `_next/*`, `/unlock` itself, and `*.svg`, not just `_next/static`/`_next/image`.
- Fixed in passing (chunk-21's defect #4, pulled forward since it sat in the
  same function being touched): `Math.max(...sessions.map(...))` on `/plan`
  was `-Infinity` when a program had zero sessions.
- ESLint now bans a bare `import { X } from '@mui/material'` /
  `'@mui/icons-material'` — every existing import was already the deep,
  tree-shakeable form; this keeps it that way.

**First-load JS, from `next build`** (baseline for chunk 21's budget):
`/` 147 kB · `/history` 152 kB · `/plan` 161 kB · `/settings` 180 kB ·
`/session/[id]` 213 kB. All above chunk 21's eventual per-route targets, as
expected before the route/bundle work in chunks 15 and 21.

**Deviated:** `force-dynamic` was not removed anywhere — see `DECISIONS.md`
2026-08-25. `unstable_cache` could not be exercised against live Supabase data
in this sandbox (its network allowlist blocks `evlxbewvsgrlncvtagmf.supabase.co`
outright), so caching correctness rests on the type/build/test suite passing
plus manual review, not an observed cache hit in a running instance.

**Next chunk must know:** `repo.ts` now exports `TAGS` — chunk 15+ code adding
new repo reads/writes should use the existing tags rather than inventing
path-based revalidation again. `AppShell`'s tab list and its prefetch/highlight
pattern is exactly what chunk 15 generalises into `DESTINATIONS` for the
five-destination shell — reuse the click/pathname reconciliation approach.

**Blocked:** nothing. `pnpm test` (213/213), `pnpm lint`, `pnpm typecheck`,
`pnpm build` all clean.

## Chunk 15 — Navigation & responsive Material 3 shell — 2026-08-25
**Landed:** The five-destination IA from `06-REDESIGN-PLAN.md` §4, replacing
the old three-tab shell.

- New routes: `/today` (the old `/plan` hero — today's/next session, week
  strip, this week's list), `/program` (the whole active block, every week,
  plus a "Build my own program" entry point), `/program/builder` (full-screen
  stub for chunk 18), `/exercises` (stub for chunks 16–17), `/profile`
  (profile summary, training maxes, recent PRs, a link into Settings, and an
  honest "full analysis is coming" card for chunk 20).
  `/settings` moved to `/profile/settings`.
- `src/components/plan/` renamed `src/components/today/` (`TodayCard`,
  `NextBlockCard`, `WeekStrip`, `SessionRow`) — no behaviour change, just
  living where the new IA actually uses it.
- `next.config.ts` permanently redirects `/plan → /program` and
  `/settings → /profile/settings`; root `/` and onboarding now land on
  `/today`. Every remaining hardcoded reference to the old routes (root
  redirect, onboarding wizard, session player's "back" and post-finish
  navigation, `goToPlan`, the PWA manifest's `start_url`) updated to match.
- `AppShell` rewritten: `NavRail` (hand-built M3 rail — MUI ships no packaged
  one — pill active indicator, 88px, fixed left) and `BottomNav` are both
  always rendered and switched with CSS `display`, not branched in JS, so
  there's no hydration flash. Both share `useActiveDestination`, which
  generalises chunk 14's prefetch/optimistic-highlight fix (real `next/link`s,
  synchronous local "pending" state that reconciles against the real pathname
  once navigation lands) across five destinations instead of three.
- `PageContainer` (`src/components/PageContainer.tsx`): `narrow` (720px, the
  default) or `wide` (1200px, auto-grid by default) — `/program`, `/history`,
  `/profile` now use the screen on desktop instead of sitting in a
  phone-width column; `grid={false}` opts a wide page into its own layout
  when the default auto-fill grid doesn't fit its content (used by `/program`
  and `/profile`, both of which need a full-width header above a grid).
- `TopBar` (`src/components/nav/TopBar.tsx`): sticky, optional back arrow for
  full-screen routes (`/program/builder`, `/session/[id]`) and an action slot.
  The session player now uses it — back arrow to `/today`, title, and the
  elapsed-time clock moved into the action slot — replacing its own inline
  header row.
- Theme: added real M3 `PaletteColor` groups via module augmentation —
  `primaryContainer`, `secondaryContainer`, `tertiary`/`tertiaryContainer`,
  `surfaceContainerLow`/`surfaceContainer`/`surfaceContainerHigh` — and
  deleted the old `CONTAINER` plain-object export (nothing else used it).
  `outlineVariant` deliberately not added: MUI's own `divider` already carries
  that exact role at the same values. `TodayCard`/`NextBlockCard` moved off
  `primary.main` + hardcoded `rgba(255,255,255,0.18)` chips onto
  `primaryContainer` + outlined chips with `color: 'inherit'`, which is
  correct in both schemes instead of only happening to work in one. Added a
  three-way (system/light/dark) theme toggle in Settings via MUI's
  `useColorScheme`. `MuiListItemButton`/`MuiCardActionArea` now default to a
  48px minimum height.
- All `loading.tsx` skeletons updated to match: removed page-title skeleton
  rows now that the title lives in `TopBar` (kept where the real page has its
  own *additional*, dynamic heading below the static TopBar title — `/today`
  and `/program` both do); `HistorySkeleton` now returns two bare `<Box>`
  siblings instead of a wrapping `Stack`, matching the shape `PageContainer`'s
  grid expects; `SessionSkeleton` now shapes a TopBar bar instead of an inline
  title+timer row.

**First-load JS, from `next build`:** `/` 146 kB · `/exercises` 153 kB ·
`/history` 157 kB · `/program` 160 kB · `/program/builder` 152 kB ·
`/profile` 158 kB · `/profile/settings` 186 kB · `/today` 163 kB ·
`/session/[id]` 214 kB. Roughly flat versus chunk 14's baseline despite two
new nav components rendering on every page — the shared chunk absorbed it.

**Verified live** (dev server, this sandbox's network allowlist blocks
Supabase so only routing/rendering could be checked, not real data): all nine
routes return 200; `/plan` and `/settings` return 308 to the right
destination; `/exercises` and `/program/builder` (no DB calls) render their
real content; all five nav labels present in the markup on every page.

**Next chunk must know:** `PageContainer`, `TopBar`, `AppShell`'s
`title`/`action`/`backHref` props, and the `primaryContainer`/`tertiary`/
`surfaceContainer*` theme tokens are all now the standing conventions —
chunks 16–21 should reach for these rather than inventing page chrome again.
`/exercises` and `/program/builder` are real routes with real stub content;
chunks 17 and 18 replace the stub body, not the route or its nav entry.

**Blocked:** nothing. `pnpm test` (213/213), `pnpm lint`, `pnpm typecheck`,
`pnpm build` all clean.

## Chunk 16 — Exercise library: muscle taxonomy, expansion, Filly set — 2026-08-25
**Landed:** The muscle-group taxonomy the app was completely missing, and the
library grown from 101 to 286 movements without changing the generator at
all.

- New `src/core/library/muscles.ts`: 25 `Muscle`s, 12 `MuscleGroup`s
  (chest/back/shoulders/arms/core/quads/hamstrings_glutes/calves/carry_grip/
  cardio/mobility/full_body), `groupsFor()` deriving groups from
  `primaryMuscles`. `outlineVariant`-style redundancy avoided deliberately:
  mobility/cardio/full_body aren't muscle-led categories, so `browseGroupsFor`
  in `query.ts` layers pattern- and `isFullBody`-driven exceptions on top
  rather than forcing them into the pure muscle taxonomy.
- `Exercise` gained `primaryMuscles` (required), `secondaryMuscles`,
  `mechanic`, `force`, `styles`, `skillGated?`, `howTo?`, `isFullBody?`, and
  **`inGeneratorPool?`** — the containment mechanism the whole chunk depends
  on. `query.ts`'s `isPermitted()` (shared by `find()` and `substitute()`)
  now rejects `inGeneratorPool === false` outright, so a library-only
  movement is structurally unreachable by the generator, not just
  conventionally excluded.
- The old blunt banned-word test (`'snatch','clean','muscle-up',…` as
  substrings of the id) is gone, replaced by an assertion that every
  `skillGated` movement is `complexity: 'advanced'` **and**
  `inGeneratorPool: false`. This unblocked KB clean, KB snatch, pistol squat,
  muscle-up and handstand push-up as real library entries the builder and
  browser can reach, while the generator still can't select any of them —
  demonstrated by five real entries in `full-body.ts`.
- `exercises.ts` (one 159-line file) replaced by `exercises/` — twelve files,
  one per muscle group, plus `helpers.ts` (the `mk()` builder) and
  `index.ts` (concatenates, exports `EXERCISES`/`BY_ID`/`getExercise` — same
  public shape, so every existing importer needed zero changes). All 101
  pre-existing movements were re-filed by primary muscle group (not just
  moved — each also gained real muscle/mechanic/force data) rather than kept
  in their old pattern-based grouping; chunk-21 defect #6 (a lunge-pattern
  movement filed under a hinge comment block) was fixed in the process.
- 185 new movements added, every one `inGeneratorPool: false`. New
  `Equipment` values (`rings`, `landmine`, `sandbag`, `machine`, `ghd`) added
  to `full_gym` only, exactly as planned — no smaller equipment profile's
  reachable movements changed.
- 63 movements tagged `functional_bodybuilding` (target was ≥ 50): tempo
  squats, Zercher/landmine/sandbag work, bottoms-up KB pressing, Meadows/seal/
  tempo ring rows, kickstand RDL, B-stance hip thrust, Copenhagen plank,
  Turkish get-up, devil's press, and more.
- `exercises.test.ts` rewritten: taxonomy validation (every muscle real, no
  primary/secondary overlap), per-group minimum counts, the FB-set count, a
  tripwire pinning the generator pool at exactly 101, an `~280` floor on
  total library size, and a new substitution test proving `substitute()`
  never reaches a non-pool movement for any equipment profile.

**Verified:** all 221 tests pass, including the unmodified 150-combination
matrix — proof the backfill preserved every pre-existing movement's original
equipment/tier/alternatives/contraindications exactly, since the matrix test
would have caught any drift. `pnpm lint`, `pnpm typecheck`, `pnpm build` all
clean.

**Deviated:** three real ones, each recorded in `DECISIONS.md` — the actual
pre-expansion count was 101 (not the plan's ~93 estimate), the library is
organised by muscle group rather than movement pattern, and `howTo` was
written sparingly rather than for all ~286 entries (it's explicitly optional;
`cue` already carries the one-line coaching point everything today actually
uses). Total landed at 286, not exactly 300 — the plan's own per-group
minimums sum to 314, of which 101 pre-existed; the gap was made up with two
extra skill-gated entries rather than padded further, per the plan's own
"a short, honest list beats padding."

**Next chunk must know:** `browseGroupsFor(exercise)` in `query.ts` is the
one function chunk 17's browser should call to place a movement into its
muscle-group buckets — do not re-derive this in the UI layer. Bundle sizes
grew (`/session/[id]` 214→226 kB, `/profile/settings` 186→198 kB) because the
larger library ships to the client wherever `getExercise`/`EXERCISES` is
imported client-side — worth a look in chunk 21's budget pass, not a blocker
now.

**Blocked:** nothing.
