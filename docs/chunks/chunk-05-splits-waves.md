# Chunk 05 — Splits, day placement, waves and training-max maths

**Read first:** `docs/00-CONTEXT.md`, then `docs/01-METHODOLOGY.md §2`, §5.1, §5.2.
**Depends on:** 04. **Size:** M.

## Mission
Turn "how many days per week" into a validated weekly skeleton, and turn a
training max into week-by-week prescriptions.

## Deliverables

1. **`src/core/generator/split.ts`**
   - `SKELETONS: Record<2|3|4|5|6, SessionArchetype[]>` exactly as §2.
   - `buildWeekSkeleton(daysPerWeek, preferredWeekdays?)` → an ordered
     `{ dayNumber, weekday, archetype, mainPattern }[]`.
   - Weekday placement per the §2 table; when the user supplies
     `preferredWeekdays`, honour them but still run the spacing checks.
   - `assertPatternSpacing(skeleton)` — throws if the same main pattern appears
     within 48 h (constraint B7). Exported separately so the settings screen can
     warn without blocking later.
   - `describeSkeleton(daysPerWeek)` → the one-line human description used by
     the onboarding cards ("3 days — full-body, one heavy lift each day").
2. **`src/core/progression/waves.ts`**
   - `WAVE_4` and `WAVE_6` as data tables matching §5.1 exactly: per week,
     the working sets, reps, `%TM`, RPE cap, rest, plus the optional top set.
   - `prescriptionFor({ weeks, week, trainingMaxKg, roundingKg })` →
     `PrescribedSet[]` including the 3 ramp sets (40/60/80 % of the day's
     working load, 3 reps, 60 s rest, `set_kind: 'ramp'`).
   - Rounding: `roundToIncrement(kg, 2.5)` by default, `1.25` for upper-body
     when the user has micro-plates (flag in the input).
   - `isDeloadWeek(weeks, week)` and `deloadAdjustments()` returning the §5.1
     deload rules as data the assembler consumes.
3. **`src/core/progression/trainingMax.ts`**
   - `epley(weightKg, reps)`, `estimateTrainingMax({ weightKg, reps, rpe? })`
     → `e1RM × 0.9 × 0.95` for first blocks, floored to 2.5 kg.
   - `nextTrainingMax({ current, topSetResult, consecutiveHolds })` implementing
     the §5.2 table, including the two-consecutive-holds rule that also returns
     `forceSixWeekWave: true`.
   - `defaultTrainingMaxes(bodyweightKg, experience)` — conservative fallbacks
     when the athlete skips onboarding step 4 (document the multipliers in the
     file header and keep them cautious).
4. **Tests**
   - `split.test.ts` — for each of 2..6: correct archetype count, correct
     weekday spacing, no pattern within 48 h, and `preferredWeekdays` honoured;
     a deliberately bad `preferredWeekdays` (`[1,2]` for 2 days with the same
     main pattern) throws.
   - `waves.test.ts` — week 3 of the 4-week wave yields 5×3 @82 % plus a top
     single set @87 %; deload week 4 is 2×5 @60 %; ramp sets are always 3 and
     never counted as working sets; all loads land on 2.5 kg increments.
   - `trainingMax.test.ts` — Epley cases, each row of the §5.2 table, and the
     two-holds path.

## Acceptance criteria
- [ ] Every row of the §5.1 tables is asserted by a test (no unverified table rows).
- [ ] `buildWeekSkeleton` output is deterministic for identical inputs.
- [ ] Four green commands.

## Do NOT
- Do not pick exercises here — that is chunk 06.
- Do not touch the database.

## Commit
`feat(core): add weekly split skeletons, wave tables and training-max maths`
