# Chunk 26 — The test week

**Depends on:** nothing in this phase — independent of chunk 25, can run
before or after it. **Size:** M.
**Read first:** `docs/11-COACH-PLATFORM.md §3` (the `'tested'` source),
`§7` and `§8` (why this exists and why it doesn't replace the inferred
verdict); `docs/01-METHODOLOGY.md §5` (waves, peak week, deload) and `§5.2`
if it exists (training-max roll-over) for the periodization this sits next
to; `src/core/progression/trainingMax.ts` and `src/server/nextBlock.ts` —
read both fully, this chunk adds a second path alongside them, not a
replacement.

Today, every training max moves on an *inferred* verdict —
`nextTrainingMax()` reads the peak week's already-programmed top set (RPE
and rep completion) and guesses where the max actually sits. That's a
reasonable default, but it's still an estimate. This chunk adds the
opt-in alternative: actually test it.

---

## 1. What a test week is

A short (2–3 session) week, offered from `/program/complete` (chunk 23's
retrospective) as an alternative to "Start next block": instead of jumping
straight into the next block on the inferred maxes, the athlete spends a
few sessions attempting a real top single (or a rep-max, your call — pick
one shape and justify it in `DECISIONS.md`; a top single mirrors what the
peak week already asks for and needs no new UI to express a target) on
each T1 lift the current program actually trained, then the *next* block's
training maxes are set directly from what was lifted — not inferred.

**Do not build a full second generator mode.** This is closer to the
existing deload week's shape than to `generateProgram`: a handful of
sessions, one per main-pattern cluster (squat/hinge on one day, press/pull
on another — reuse the day-clustering the split logic in
`docs/01-METHODOLOGY.md §2` already uses, don't invent a new skeleton),
each a primer, the T1 test attempt, and light accessory work — no full
six-block session, no time-budget trimming ladder to satisfy, since these
sessions are short and low-volume by design.

## 2. `src/core/progression/testWeek.ts` — pure

- `buildTestWeek(program: Program, testExerciseIds: string[]): PlannedWeek`
  — takes the just-finished program (to know which T1 lifts it actually
  trained — `mainPattern`/the `main` block's exercise on each session) and
  produces a short week: a primer block, a ramp to a top single (reuse
  `assembleSession.ts`'s or the wave table's existing ramp-set shape rather
  than inventing a new one), and a couple of light accessory sets so the
  session isn't a 5-minute visit. One session per day the split already
  used for that pattern; don't invent new weekdays.
- `trainingMaxFromTestResult(weightKg: number, reps: number): number` —
  when `reps === 1`, the tested weight itself (rounded to increment, same
  rounding `roundToIncrement` already uses); when `reps > 1`, run it
  through `epley()`/`trainingMaxFromOneRepMax()` (`trainingMax.ts` already
  has both) rather than a third formula.

Unit test both directly: a single at a given weight round-trips to itself
(rounded); a 3-rep test produces the same number `estimateTrainingMax`
would for the same inputs where the formulas should agree; a test week
built from a program with only two T1 lifts produces exactly two test
sessions, not a full skeleton's worth.

## 3. Migration

Widen `t4m_training_max.source`'s check constraint to allow `'tested'`
alongside the existing five values. Find the constraint (`information_schema`
or `pg_constraint` against `cyberpunk-vibe01`, don't assume its exact name
without checking) and alter it in one migration. Apply live, confirm.

## 4. Server

- `src/server/actions.ts` (or a new `src/server/testWeek.ts` if that reads
  cleaner against the size of `actions.ts` already — your call, record it):
  `startTestWeek(): Promise<Result<{ sessionIds: string[] }>>` —
  `requireUnlocked()` first, builds the week via `buildTestWeek`, persists
  it as real `t4m_session` rows the same way any other session gets
  persisted (reuse `repo.persistProgram`'s session-writing path or
  `materializeRoutine`'s if that's a closer fit — don't write a third
  session-insert path).
- `finishTestSet`/reuse of `logSets` — test-week sessions log sets through
  the *exact same* session player and `logSets` action as any other
  session (this is the point of the runtime `blocks` contract in
  `docs/02-DATA-MODEL.md §2` — a third producer, same shape, no changes
  needed downstream). Confirm this rather than assuming it — write the
  integration test that proves a test-week session's `blocks` validates
  against the same `SessionBlock[]` shape the other two producers use.
- `applyTestWeekResults(): Promise<Result>` — reads the logged test sets,
  computes new training maxes via `trainingMaxFromTestResult`, writes them
  with `source: 'tested'` via `repo.setTrainingMaxes` (already exists),
  and — this is the part that must not regress `startNextBlock` — hands
  off into the **same** next-block generation `startNextBlock` already
  does, just seeded from the tested maxes instead of letting
  `rollOverTrainingMaxes()` infer them for the lifts that were tested.
  Lifts the test week didn't cover (an accessory training max, if any
  exist outside T1) still go through the normal inferred path. Read
  `startNextBlock` in `src/server/actions.ts` closely before touching it —
  the goal is one shared code path with an optional pre-seeded max map,
  not two divergent implementations of "start the next block."

## 5. UI

`/program/complete` (chunk 23) gains a second button, "Test your maxes
first," alongside "Start next block" — same card, not a separate page for
the choice. Taking it routes into the short test-week flow (reuse the
session player unmodified); finishing the last test session offers
"Apply and start next block," which calls `applyTestWeekResults` then
`startNextBlock`'s existing block-start path, landing on the same
`/program/complete` retrospective as any other block start
(`DECISIONS.md`, 2026-08-30, "startNextBlock's own success path...
navigates straight to the retrospective").

The retrospective itself: a TM change whose `source` is `'tested'` should
read differently from an inferred one — `retrospective.ts`
(`src/core/progression/retrospective.ts`, chunk 23) already renders
`tm_changes`' `reason` string; either extend that struct with the source or
have `applyTestWeekResults` write a `reason` string that says "tested: 3
reps at 120 kg" rather than an inferred-verdict sentence. Pick the simpler
of the two — likely the `reason` string, since `retrospective.ts` already
renders it as free text and a schema change there ripples into chunk 23's
shipped code for no real benefit.

## 6. Tests

- `testWeek.test.ts`: `buildTestWeek` produces one session per tested
  pattern, each with a top-single (or chosen rep scheme) target and no
  T1-block trimming logic running against it; `trainingMaxFromTestResult`
  matches `epley`/`estimateTrainingMax` where they should agree.
- An integration-shaped test (matching whatever level the rest of
  `src/server` tests at — see `DECISIONS.md`'s note on chunk 19 having no
  DB-backed test, follow the same "pure formula cross-check" approach
  where a live DB isn't available) proving a test-week session's `blocks`
  round-trips through the session player's existing set-logging path.
- `applyTestWeekResults`: a tested lift gets `source: 'tested'`; an
  untested lift in the same block still gets the normal inferred verdict;
  the next program that comes out has the tested lift's training max
  exactly equal to what was logged (rounded), not the inferred guess.

## Acceptance

- [ ] `/program/complete` offers "Test your maxes first."
- [ ] A test week is a handful of real, short sessions in the existing
      session player — no new player code.
- [ ] Training maxes set from a test week carry `source: 'tested'` and the
      exact tested (rounded) value, not an inferred one.
- [ ] The retrospective states which TMs came from a test and which were
      inferred.
- [ ] Skipping the test week (choosing "Start next block" directly) behaves
      exactly as it did before this chunk — zero regression to the
      existing path.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.

---

Commit message: `feat: chunk 26 — the test week`
