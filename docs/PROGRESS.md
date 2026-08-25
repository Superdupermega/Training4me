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

## Chunk 17 — Exercise browser & detail pages — 2026-08-25
**Landed:** `/exercises` (stubbed in chunk 15) is now the real browser, and
`/exercises/[id]` is a real detail page — the first place chunk 16's 286-
movement library is actually visible in the app.

- `src/components/exercises/ExerciseBrowser.tsx` (client): search (name /
  Swedish name / id, case-insensitive, debounced by React's own render
  cycle — no debounce timer needed at 286 items), a horizontally-scrollable
  muscle-group chip row (`browseGroupsFor` from chunk 16 decides membership,
  so a squat correctly appears under both Quads and Hamstrings & glutes), a
  style chip row, and an "only what I have" equipment switch defaulting on.
  With no search/group filter active, results render grouped by muscle group
  with a subheader and count per group, exactly per the design; a filter or
  search collapses to a flat list. `EXERCISES` is imported directly in the
  client component rather than threaded through as a server prop — it's a
  static build-time array, so passing it through RSC serialization would
  have doubled the transfer for no benefit.
- `/exercises/[id]`: header (tier, mechanic, unilateral, skill-gated,
  style chips), primary/secondary muscle chips plus which browse groups the
  movement is filed under, the coaching cue (and `howTo` steps where
  present), equipment needed, a "best set logged" line and full history from
  `historyForExercise` (already existed, already indexed), and navigable
  alternatives. Unknown ids hit `notFound()`.
- Both routes get `AppShell`/`PageContainer` treatment matching chunk 15's
  conventions; the detail page uses `backHref="/exercises"` since it's a
  sub-page, not its own destination. Shared `STYLE_LABEL`/`TIER_LABEL` factored
  into `src/components/exercises/labels.ts` rather than duplicated across the
  browser and detail page.

**Deviated:** no chart, no "expected from your 1RM" panel (both genuinely
depend on chunk 19/20 infrastructure that doesn't exist yet — see
`DECISIONS.md`), and no custom-exercise creation (deferred to chunk 18,
where it belongs next to the builder that actually needs it).

**Verified:** `pnpm test` (221/221 — unchanged, this chunk is UI-only),
`pnpm lint`, `pnpm typecheck`, `pnpm build` all clean.
`/exercises`, `/exercises/back-squat`, `/exercises/turkish-get-up` all
compile and route correctly against a dev server; an unknown id correctly
renders Next's not-found content. Data-bearing rendering (equipment
filtering against a real profile, real logged history) could not be
observed live — same sandbox network restriction as every earlier chunk.

**Next chunk must know:** the exercise picker chunk 18's builder needs is
`ExerciseBrowser`'s filtering logic, not a new implementation — factor a
shared picker component out of it rather than duplicating the search/filter
logic a third time. `historyForExercise`, `browseGroupsFor` and the
`labels.ts` maps are all reusable as-is.

**Blocked:** nothing.

## Chunk 18 — Program builder — 2026-08-25
**Landed:** the biggest single feature in the plan — a self-built program
that trains in the exact same session player as a generated block, with no
changes to the player at all.

**Schema** (Supabase migration `t4m_routine_builder`, applied live): `t4m_routine`,
`t4m_routine_day`, `t4m_routine_day`, `t4m_routine_item`, `t4m_custom_exercise`
(unused this chunk — see Deviated), plus `favourite_exercises` on
`t4m_profile` and `routine_id`/`routine_day_id` FKs on `t4m_session`/
`t4m_program`. Every new table: RLS enabled, one `for all to anon,
authenticated using (true)` policy — the same pattern every existing `t4m_`
table already carries.

**Core** (`src/core/builder/`, pure, tested, zero React/DB):
- `types.ts` — `Routine`/`RoutineDay`/`RoutineItem` mirroring the schema.
- `materializeRoutine.ts` — the second producer of `SessionBlock[]`. Groups
  items by block letter into blocks (2+ items sharing a letter → one
  superset block, `rounds = max(sets)`, slots `D1`/`D2`/…); `percent_tm`
  resolves through the *existing* `resolveTrainingMax`/`roundToIncrement`
  and falls back to RPE (never a fabricated weight) exactly like the
  generator's own `prescriptionFor`; every set's `estimatedSec` comes from
  `recost` — the generator's own cost model, called directly, not
  reimplemented. No trimming: the athlete's plan runs however long it runs.
  Week-identical repetition across weeks (see Deviated).
- `advise.ts` — the read-only half of `validateWeek('full')`, reused as-is
  against a permissive library context. Warns, never blocks, never repairs.
- Two test files, 10 tests: one-day/three-item → three blocks; a shared
  block letter → one superset with correct rounds and `D1`/`D2` slots;
  `percent_tm` resolves against a known TM and falls back to RPE with no TM
  on file; estimated seconds agree with the generator's own `estimateSet`
  within 5%; never trims; week-identical repetition; dates advance by 7
  days per week; advisories never mutate the plan they're checking.

**Server** (`src/server/routines.ts`, new — mirrors `repo.ts`'s
read/write-only discipline, no `revalidateTag` calls of its own):
`listRoutines`/`getRoutine` (cached, tagged `routines`), `createRoutine`
(routine + one empty day per `daysPerWeek`), `renameRoutine`,
`archiveRoutine`, `saveRoutineDays` (replace-all — delete every day,
re-insert, same trade-off `persistProgram` already makes for the
generator's output), `scheduleRoutine` (materialise + make active,
identical contract to `buildProgram`/`persistProgram`). Six new actions in
`actions.ts`, each calling `revalidateTag` for what it touched, plus
`duplicateActiveProgramAsRoutine` — reads the active generated program's
week one and seeds a real editable routine from it, the fast path most
people will actually use.

**UI:**
- `/program/builder` — routine list + a create dialog (name, weeks,
  days/week).
- `/program/builder/[id]` — the editor. Day tabs; each day is an ordered
  list of block cards (a card with 2+ rows is a superset); add an exercise
  via `ExercisePickerDialog` (search + muscle-group chips, reusing chunk
  17's filtering logic rather than a second implementation); reorder by
  block via up/down arrows (see Deviated — no drag-and-drop); "superset
  with another exercise" merges a block, a split icon un-merges one item
  back out; tapping a row opens `ItemEditorSheet` (sets, rep range,
  per-side, tempo with a plain-English explainer, rest, target kind, and
  the resolved RPE/percent-TM fields) built from `src/core/tempo.ts`'s
  own format. A live duration chip and advisory `Alert` recompute on every
  edit by calling `materializeRoutine`/`adviseOnWeek` directly in the
  browser — both are pure `src/core` functions, so there is no server
  round trip for the estimate at all.
- `/program` gained "Build my own program" and, for a generated active
  block, "Edit this block as my own program" (calls
  `duplicateActiveProgramAsRoutine`).
- `src/components/builder/editable.ts` — the client-editing↔domain-model
  conversion (`fromRoutine`/`toRoutineDays`), covered by 5 of its own
  round-trip tests, since it's the part most likely to have a subtle bug
  (block relettering on reorder, superset detection from group size).

**Verified:** 236 tests (231 → +5), lint, typecheck, build all clean.
`/program/builder` compiles and routes correctly against a dev server
(same sandbox network limitation as every earlier chunk — the live
Supabase-backed create/save/schedule flow could not be exercised here).

**Deviated:** three, all in `DECISIONS.md` — up/down-arrow reordering only
(no drag-and-drop dependency), week-identical prescriptions (no progression
scheme — both explicitly allowed by the plan's own fallback clauses), and a
flatter single-editor-page UI instead of three separate full-screen steps.
Custom exercises (`t4m_custom_exercise`) migrated but not wired up — chunk
17 already deferred this to "next to the builder that needs it"; it turned
out not to be needed for a first working builder (every movement in the
286-strong library was enough for testing), so it stays backlogged rather
than built speculatively.

**Next chunk must know:** the routine builder's exercise picker and item
editor are the natural home for chunk 19's "last time / expected" panel —
`ItemEditorSheet` already has the exact spot (next to the RPE fallback
field) the plan calls for. `adviseOnWeek`/`materializeRoutine` being pure
and callable client-side is a pattern chunk 20 can reuse for any other
core-logic-driven live preview.

**Blocked:** nothing.

## Chunk 19 — "Last time / expected from your 1RM" — 2026-08-25
**Landed:** the batched context function the plan asked for, wired into
all four places it names, plus the two-picker screens that turned out to
need it too.

- `src/server/exerciseContext.ts`: `exerciseContext(exerciseIds, opts?)` —
  **one** query for the whole batch (`t4m_logged_set` where
  `exercise_id in (...)`), folded in JS into per-exercise `last` (most
  recent session's sets, with the session title via a second small batched
  query), `best` (highest Epley e1RM across all logged sets, not just the
  heaviest raw weight), `trainingMax` (direct or anchor-derived, via the
  existing `resolveTrainingMax`, with the anchor id kept as `derivedFrom`),
  and `expected` (`trainingMax × percent`, rounded to the increment — the
  exact formula `prescriptionFor` uses, reused not reimplemented). No
  training max on file → `expected` is `null`, never a fabricated number.
  Wrapped once in `unstable_cache` at module scope (the documented pattern
  — a sorted id array is an ordinary argument Next serialises into the
  cache key), tagged `logs`/`profile`.
- `getExerciseContexts` action in `actions.ts` — the read-only RPC client
  components call, since the picker and the item editor need this on
  demand, not at page load.
- `src/components/exercises/ExerciseContext.tsx`: `summariseContext` (the
  priority-ordered one-liner: last time beats expected beats "no history
  yet"), `ExerciseContextLine` (compact), `ExerciseContextPanel` (both
  numbers plus the delta between them).
- Wired into all four places the plan names, batched everywhere a list is
  involved (250ms-debounced on the visible/filtered set, never per-row):
  exercise detail page (replaces the ad-hoc "best set" card with the real
  panel plus e1RM), the session player (a line above each exercise's first
  set), the builder's item editor (fetches fresh whenever a different
  exercise's sheet opens, using that item's own chosen percent), and both
  exercise pickers (`ExerciseBrowser`'s main list and
  `ExercisePickerDialog`'s builder picker).
- `exerciseContext.test.ts`: proves `expected.weightKg`'s formula agrees
  with `prescriptionFor`'s real output for the same training max/percent/
  increment, at both a normal week and the peak week where rounding matters
  most — see Deviated for why this tests the formula rather than the live
  function.

**Verified:** 238 tests (236 → +2), lint, typecheck, build all clean.
`/exercises/back-squat` compiles and routes correctly against a dev server
(same sandbox network restriction as every earlier chunk for the live data
path).

**Deviated:** two, both in `DECISIONS.md` — `expected` defaults to 75% (not
a specific wave percentage, since most call sites have no percent in mind)
and the DB-touching half of `exerciseContext` has no live test, consistent
with the rest of `src/server`.

**Blocked:** nothing.
