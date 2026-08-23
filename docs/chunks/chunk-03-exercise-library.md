# Chunk 03 — Exercise library

**Read first:** `docs/00-CONTEXT.md`, then `docs/01-METHODOLOGY.md §4` and §7,
and `docs/02-DATA-MODEL.md` "exercises".
**Depends on:** 01 (02 only for the seed migration). **Size:** M.

## Mission
Build the movement library — the vocabulary the generator speaks — as pure
typed data, with the query and substitution logic on top.

## Deliverables

1. **`src/core/library/exercises.ts`** — `export const EXERCISES` , a
   `readonly Exercise[]` of **at least 70 movements**, every field from
   `docs/01-METHODOLOGY.md §4.3` populated, no placeholders.
   Coverage requirements:
   - ≥ 6 per pattern for `squat`, `hinge`, `push_h`, `push_v`, `pull_h`, `pull_v`
   - ≥ 4 `carry`, ≥ 6 `trunk`, ≥ 4 `aerobic`, ≥ 6 `mobility`
   - ≥ 8 T1 barbell lifts, ≥ 20 T2, ≥ 20 T3
   - ≥ 3 bodyweight-only options per pattern where anatomically possible
   - every `alternatives` id exists; every T1/T2 has ≥ 2 alternatives
   - `complexity: 'advanced'` is allowed in the data but only for movements a
     user could opt into; **no** snatch, clean & jerk, muscle-up, kipping
     anything, or handstand push-up in v1 at all.
   - `loadingSecondsPerRep` is realistic per movement (deadlift 4.5, curl 2.5,
     carry uses distance instead — set 0 and mark `metric: 'distance'`).
   - `cue` is one short imperative sentence in plain language.
2. **`src/core/library/query.ts`**
   - `isAvailable(exercise, equipment): boolean` — every required item present.
   - `findByPattern(pattern, opts)` — filter by tier, equipment, unilateral,
     complexity ceiling, `allowAdvanced`, active pain flags, an exclusion list.
   - `substitute(exercise, ctx)` — the 5-step preference ladder from
     `docs/01-METHODOLOGY.md §4.5`; throws `NoSubstituteError` at the end.
   - Deterministic ordering everywhere (sort by a stable key before picking) so
     the generator stays reproducible.
3. **`src/core/library/equipment.ts`** — the five profiles and their expansion to
   concrete equipment sets, plus the individual toggles.
4. **Validation test** `src/core/library/exercises.test.ts`:
   - every id is unique, kebab-case, and matches its slug conventions
   - every `alternatives` / `contraindications` value is valid
   - every pattern/tier/complexity string is in the taxonomy
   - the coverage counts above are asserted numerically
   - for **each of the 5 equipment profiles**, every pattern still has ≥ 1
     available movement at T2 or T3 (i.e. no profile can strand the generator)
5. **`src/core/library/query.test.ts`** — substitution ladder cases: missing
   rack, pain flag on knee, exclusion list, and the `NoSubstituteError` path.
6. **Seed migration** `supabase/migrations/0009_seed_exercises.sql` — generated
   from `EXERCISES` by a small script `scripts/generateSeed.ts`
   (`pnpm seed:generate`), using `insert ... on conflict (id) do update` so it
   is re-runnable. Apply it with the Supabase MCP `apply_migration`.
7. A test asserting **the SQL seed and the TS array agree** on ids and count
   (parse the SQL, compare sets) so the two can never drift.

## Acceptance criteria
- [ ] `EXERCISES.length >= 70` and all validation tests pass.
- [ ] `select count(*) from exercises` in Supabase equals `EXERCISES.length`.
- [ ] `pnpm seed:generate` is idempotent — running it twice produces no diff.
- [ ] Four green commands.

## Do NOT
- Do not write any generator logic (chunks 05/06).
- Do not import React, Supabase or anything else banned in `src/core`.
- Do not pad the library with near-duplicates to hit 70 — every entry must be a
  movement you'd actually program.

## Commit
`feat: add exercise library with query, substitution and seed migration`
