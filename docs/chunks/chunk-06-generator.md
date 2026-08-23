# Chunk 06 — THE GENERATOR (the heart of the product)

**Read first:** `docs/00-CONTEXT.md`, then `docs/01-METHODOLOGY.md §3, §4, §5.1, §6, §8`.
**Depends on:** 03, 04, 05. **Size:** L — has a split point, see below.

## Mission
Take a `GeneratorInput` and produce a complete, rule-valid, in-budget mesocycle:
every week, every session, every block, every set, every load. Pure functions
only. When this chunk is done the product exists — just without a UI.

> **Split point.** If the session is getting long, commit after PART A
> (`feat(core): assemble sessions from archetypes`), `/clear`, then run PART B.

---

## PART A — session assembly

1. **`src/core/generator/selectExercises.ts`**
   - `pickT1(archetype, ctx)` — the barbell lift for the day's `mainPattern`,
     filtered by equipment/pain/complexity, preferring the athlete's existing
     training maxes so loads are known. Stable, seeded choice.
   - `pickT2(session, ctx)` — must be unilateral **or** a different plane than
     the day's T1 (§3.3).
   - `pickT3Pair(ctx, deficits)` — returns a non-competing antagonist pair
     (§3.4) chosen to reduce the week's largest balance deficit.
   - `pickT4(weekNumber)` — the §3.5 four-week rotation: carry / trunk / Z2 / carry.
   - `pickPrimer(archetype)` — the §3.1 fixed recipe for that archetype.
   - All picks avoid the `usedThisWeek` map (constraint B10, max 2 uses/week)
     and take the seeded RNG as a parameter.
2. **`src/core/generator/assembleSession.ts`**
   - `assembleSession({ archetype, weekNumber, ctx, rng })` → `PlannedSession`
     with blocks A–F in order, slot letters assigned (`A1`, `B`, `C`, `D1`,
     `D2`, `E`, `F`), tempos applied (T1 `20X1`, deadlift variants `21X1`,
     T2 `30X1`), rests per §3, and every `PrescribedSet` fully specified
     (reps, %TM or RPE target, weight where a TM exists, rest, estimate).
   - Applies the deload adjustments from chunk 05 when the week is a deload.
   - Runs `fitToBudget` at the end and stores `estimatedSeconds` + the trim log.
   - Archetypes `AEROBIC-MOBILITY` and `PUMP-BALANCE` have their own shapes:
     no T1, primer → Z2/mobility circuit → carry/trunk → down-regulate; and
     primer → three T3 supersets → down-regulate, RPE ≤ 8, no spinal loading.
3. **Tests** — `assembleSession.test.ts`:
   - every archetype produces blocks A–F in order with unique slot letters
   - exactly one T1 for loaded archetypes, none for the two special archetypes
   - every session ≤ its cap; T1 never trimmed
   - deload week has halved T3 rounds and Z2 in block E
   - the same seed produces an identical session twice; a different seed may differ

---

## PART B — week validation, repair, and the full program

4. **`src/core/generator/balance.ts`**
   - `countSets(week)` → per-pattern working-set counts (ramp sets excluded).
   - `validateWeek(week, ctx)` → `BalanceViolation[]` covering **every**
     constraint B1–B10 from §4.4, each with the constraint id, the measured
     value and the allowed range.
   - `repairWeek(week, violations, ctx, rng)` — swap or add T3 work, swap a T2
     for a unilateral variant, or add a carry to block E. Max **12** iterations,
     re-validating each pass, re-running `fitToBudget` after every change.
     Throws `BalanceUnsatisfiableError` naming the unsatisfied constraint.
5. **`src/core/generator/generateProgram.ts`**
   - `generateProgram(input: GeneratorInput, rng): Program`
   - Steps: build skeleton (ch. 05) → for each week, for each day, assemble →
     validate → repair → assert → attach dates from `startDate` and weekday
     placement → name the block ("Block 2 · 4 weeks · 3 days").
   - Sets `generatorVersion = 'gen-1.0.0'` and echoes the frozen input.
   - Never returns a program containing a violation or an over-budget session.
6. **Tests — the spine of the project**
   - **`matrix.test.ts`**: for every combination of
     `daysPerWeek 2..6 × experience(3) × equipmentProfile(5) × weeks(4,6)`
     = 150 programs, assert for every week: zero balance violations; for every
     session: `estimatedSeconds ≤ cap`, exactly the right T1 count, block order
     A–F, all `alternatives`/exercise ids resolvable, no exercise used > 2×/week,
     weekly volume inside the §4.6 band. Keep it under ~20 s (build the library
     index once, reuse).
   - **`golden.test.ts`**: reproduce the worked example in §8 —
     3 days, full gym, intermediate, week 2 — and snapshot the full session
     structure. Assert the balance numbers quoted there (pull 18 / push 15,
     hinge 10 / squat 11, 38 total sets) within the documented bands.
   - **`determinism.test.ts`**: same input + same seed → deep-equal programs;
     serialising the input and regenerating reproduces it exactly
     (this is the `generator_input` contract from `docs/02-DATA-MODEL.md`).
   - **`edge.test.ts`**: `minimal_bodyweight` + 6 days still generates;
     a knee pain flag removes every knee-contraindicated movement;
     a 45-minute cap still yields a T1 on every loaded day.

## Acceptance criteria
- [ ] `matrix.test.ts` passes for all 150 combinations with zero violations.
- [ ] The golden test matches the documented example.
- [ ] No session in any generated program exceeds its cap.
- [ ] `src/core` is still pure — no imports outside the allowed set.
- [ ] Four green commands.

## Do NOT
- **Do not weaken a constraint to make the matrix pass.** If a constraint is
  genuinely unsatisfiable for some combination, fix the *repair* logic or the
  *library coverage*; only if neither works, record the case in
  `docs/PROGRESS.md` and `docs/DECISIONS.md` and propose a methodology change —
  do not silently relax B1–B10.
- Do not touch the database, server code or UI.
- Do not add randomness that isn't seeded.

## Commit
`feat(core): generate complete rule-valid mesocycles from days-per-week`
