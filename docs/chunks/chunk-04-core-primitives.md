# Chunk 04 — Core primitives: types, tempo, time budget

**Read first:** `docs/00-CONTEXT.md`, then `docs/01-METHODOLOGY.md §6` and §3.
**Depends on:** 01. **Size:** S.

## Mission
Build the domain types and the time-budget engine — the machinery that enforces
the 60-minute promise. This is small, pure, and heavily tested.

## Deliverables

1. **`src/core/types.ts`** — the domain vocabulary, each with a matching Zod schema:
   - `MovementPattern`, `Tier`, `Complexity`, `Equipment`, `EquipmentProfile`,
     `Experience`, `SessionArchetype`, `BlockKind`, `SetKind`, `PainArea`
   - `Exercise`, `PrescribedSet`, `BlockExercise`, `SessionBlock`,
     `PlannedSession`, `PlannedWeek`, `Program`
   - `GeneratorInput` (profile snapshot + training maxes + seed + start date)
   - `Readiness`, `LoggedSet`
   - Typed errors: `SessionOverBudgetError`, `BalanceUnsatisfiableError`,
     `NoSubstituteError`, all extending a `DomainError` base carrying a
     machine-readable `code` and a `details` object.
   - Export `PATTERNS`, `TIERS`, etc. as `as const` arrays; derive the union
     types from them so there is exactly one source of truth.
2. **`src/core/tempo.ts`**
   - `parseTempo('30X1')` → `{ eccentric: 3, pauseBottom: 0, concentric: 1, pauseTop: 1 }`
   - `X` = 1 s, `A` = 3 s, digits are literal seconds; invalid strings throw.
   - `secondsPerRep(tempo)` = sum.
   - Handles 4-char strings only; reject anything else with a clear message.
3. **`src/core/timeBudget.ts`** — implement §6.2 exactly:
   - `estimateSet(set, exercise)` — reps × secondsPerRep + rest, with the 8 s
     per-set work floor; distance sets use `1.2 s/m`; duration sets use their
     prescribed seconds.
   - `estimateExercise`, `estimateSuperset(pair, rounds)`, `estimateBlock`,
     `estimateSession` with `TRANSITION_SECONDS = 45`, `FIXED_OVERHEAD = 120`,
     `SUPERSET_SWITCH = 15`.
   - Constants exported and named, never inline magic numbers.
   - `applyPaceFactor(seconds, paceFactor)`.
   - `fitToBudget(session, capSeconds)` implementing §6.3: the trim ladder in
     `§1.3` order, max 20 steps, the 0.95 target, the "add back if under 75 %"
     rule, and `SessionOverBudgetError` when it cannot fit. **Never trims T1.**
     Returns `{ session, trimLog: TrimStep[] }` so the UI and tests can explain
     what was cut.
4. **Tests**
   - `tempo.test.ts` — table-driven over `20X1`, `30X1`, `21X1`, `4010`, `X`,
     `A`, and 6 invalid inputs.
   - `timeBudget.test.ts` —
     - a hand-built 4-block session estimates within ±5 % of a hand-computed number
     - `fitToBudget` on a deliberately bloated session trims to ≤ cap × 0.95
       and the trim log shows T3 cut before T2
     - `fitToBudget` on a session whose T1 alone exceeds the cap throws
       `SessionOverBudgetError` (does not silently trim T1)
     - a too-short session gains a T3 round, at most twice
     - `paceFactor` 1.3 pushes a 55-min session over a 60-min cap → trimmed

## Acceptance criteria
- [ ] 100 % branch coverage on `tempo.ts` and `timeBudget.ts` (`pnpm test -- --coverage`).
- [ ] `src/core` still imports nothing outside `zod` / `date-fns` / itself.
- [ ] Four green commands.

## Do NOT
- Do not build exercise selection, splits or waves — chunks 05/06.
- Do not read from the exercise library here; take `Exercise` objects as inputs.

## Commit
`feat(core): add domain types, tempo parsing and the session time-budget engine`
