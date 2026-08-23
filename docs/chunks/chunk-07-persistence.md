# Chunk 07 — Persistence layer: repositories and server actions

**Read first:** `docs/00-CONTEXT.md`, then `docs/02-DATA-MODEL.md` and `docs/03-ARCHITECTURE.md §4`.
**Depends on:** 02, 06. **Size:** M.

## Mission
Wire the pure generator to the database: map domain ↔ rows, persist a program
atomically, and expose the server actions the UI will call.

## Deliverables

1. **`src/server/repositories/`** — every function returns **domain types**,
   never Supabase rows:
   - `profileRepo.ts` — `getProfile`, `upsertProfile`, `updatePaceFactor`
   - `exerciseRepo.ts` — `listExercises` (cached with `unstable_cache`, 1 h;
     the library is reference data)
   - `trainingMaxRepo.ts` — `currentTrainingMaxes(userId)`, `insertTrainingMaxes`
   - `programRepo.ts` — `getActiveProgram`, `persistProgram` (calls the
     `persist_program` RPC with one jsonb payload), `abandonProgram`
   - `sessionRepo.ts` — `getSession(id)` returning the full nested session
     (blocks → exercises → sets) in **one** query using PostgREST embedding,
     `listWeek`, `startSession`, `completeSession`
   - `logRepo.ts` — `upsertLoggedSets(sets)` idempotent on `prescribed_set_id`,
     `listRecent`, `historyForExercise`
2. **`src/server/mappers/`** — explicit `rowToDomain` / `domainToRow` functions
   with a test asserting round-trip equality on a fixture. No implicit `as`.
3. **`src/server/actions/`** — each: `requireUser()` → Zod parse → repo →
   `revalidatePath` → `{ ok, data } | { ok, error }`:
   - `onboarding.ts` — `saveProfile(input)`, `generateFirstProgram()`
   - `program.ts` — `regenerateProgram(opts)` (preserves logged history,
     replaces only `planned` future sessions, and says how many were replaced)
   - `session.ts` — `beginSession(id, readiness)`, `finishSession(id, seconds)`,
     `swapExercise(blockExerciseId, newExerciseId)` (uses `core` `substitute`
     and re-runs `fitToBudget` on the session)
   - `logging.ts` — `logSets(sets[])` batch upsert
4. **`buildGeneratorInput(profile, trainingMaxes, startDate, seed)`** in
   `src/server/generator.ts` — the only place that bridges DB → `GeneratorInput`.
   The seed is stored on the program so regeneration is reproducible.
5. **Tests**
   - mapper round-trip tests (pure, always run)
   - an integration test (auto-skipped without env) that generates a 3-day
     4-week program, persists it, reads it back, and asserts the reconstructed
     domain object deep-equals the generated one **including all set loads**
   - an idempotency test: calling `logSets` twice with the same
     `prescribed_set_id` leaves one row

## Acceptance criteria
- [ ] Persisting a 4-week × 4-day program is a single RPC call and either fully
      succeeds or leaves no rows behind (verify by forcing a failure mid-payload).
- [ ] `getSession` issues one query, not N+1 (assert on the query shape or log).
- [ ] No server action throws across the boundary; all failures return `{ ok: false }`.
- [ ] Four green commands.

## Do NOT
- Do not build UI (chunks 08+).
- Do not put domain rules in repositories — rules live in `src/core`, period.
- Do not use the service-role client in any action.

## Commit
`feat(server): add repositories, mappers and server actions for program persistence`
