# Chunk 17 — Exercise browser & detail pages

**Depends on:** 15 (routes), 16 (taxonomy). **Size:** M.

## Mission

`/exercises` — the thing a StrengthLog user opens most after the logger. Browse
by muscle group, search, filter, and drill into any movement to see how to do it
and what *you* have done with it.

## 1. `/exercises` — the browser

Layout: sticky search field in the top app bar, then a horizontally scrollable
`Chip` row of muscle groups (M3 filter chips), then results.

- **Search** — matches `name`, `nameSv` and `id`; diacritic- and
  case-insensitive; debounced 150 ms; runs entirely client-side (the library is
  a static import, ~300 objects — no server round-trip, no loading state).
- **Filters** (a bottom sheet on mobile, an inline sidebar on desktop):
  muscle group, equipment (defaults to the profile's equipment, with a "show
  everything" switch), style (`functional_bodybuilding` etc.), tier, mechanic,
  unilateral, "in my program", "favourites".
- **Grouped list** — when no search/filter is active, render by muscle group
  with sticky subheaders and a count per group.
- **Row** — name, a muscle line ("Chest · Triceps, Front delts"), equipment
  icons, and — from chunk 19 — the last-time line. Rows are `ListItemButton`,
  min height 56 px.
- **Virtualise** only if a profiled scroll on a mid-range phone is below 55 fps;
  300 rows in a grouped list usually is not worth it. Measure first.

Favourites: a `t4m_profile.favourite_exercises text[]` column (add via
migration, default `'{}'`), toggled with a star on the row.

## 2. `/exercises/[id]` — the detail page

Sections, in this order:

1. **Header** — name, Swedish name, tier chip, style chips, unilateral/mechanic.
2. **Muscles** — primary and secondary as chips. If a body diagram is wanted
   later, note it as backlog; do not block this chunk on artwork.
3. **How to** — `howTo` steps as an ordered list, plus `cue` called out as the
   one-line coaching cue.
4. **Your numbers** (chunk 19's `exerciseContext`) — best e1RM, best set,
   estimated training max, current expected working load.
5. **Chart** — e1RM over time, hand-rolled SVG line (see chunk 20 §3 for the
   shared primitives). Empty state if fewer than two data points.
6. **History** — every logged set for this movement, newest first, grouped by
   session date, with weight × reps @ RPE. Paginated at 50.
7. **Actions** — "Add to a program day" (opens the builder's day picker),
   "Swap into today's session" if today's session contains a same-pattern slot.
8. **Alternatives** — the `alternatives` list as navigable rows.

Server data comes from one function: `getExerciseDetail(id)` in
`src/server/repo.ts`, returning history + PRs + context in a single round-trip
where possible (`historyForExercise` already exists and is indexed on
`(exercise_id, created_at desc)`).

## 3. Custom exercises

"+ Add exercise" in the top app bar → dialog capturing name, muscle group,
pattern, equipment, unilateral, metric, default tempo, cue. Writes to
`t4m_custom_exercise` (DDL in chunk 18 §2). Custom movements:

- get ids prefixed `custom-`;
- are merged into the browser and the builder picker at read time;
- are **never** in the generator pool;
- must be resolvable by `getExercise()` — extend it to fall back to a
  request-scoped custom map, and make it throw a clear `DomainError` rather than
  the current bare lookup failure when an id is unknown.

## Acceptance

- [ ] Every muscle group is reachable in two taps from `/exercises`.
- [ ] Search returns results with no perceptible delay and no network request.
- [ ] A detail page shows how-to, your history and your numbers.
- [ ] A custom exercise can be created, found in search, and added to a program.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build` clean.
