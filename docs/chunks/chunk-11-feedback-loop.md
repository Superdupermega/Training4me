# Chunk 11 — Feedback loop: progression, PRs and history

**Read first:** `docs/00-CONTEXT.md`, then `docs/01-METHODOLOGY.md §5`,
`docs/04-DESIGN-SYSTEM.md §5.4`.
**Depends on:** 10. **Size:** L.

## Mission
Close the loop: what the athlete logged changes what the app prescribes next —
next set, next session, next block.

## Deliverables

1. **`src/core/progression/readiness.ts`**
   - `applyReadiness(session, readiness)` → adjusted session per the §5.4 table:
     load multiplier on T1, ±1 set on T2, drop block D in the lowest band.
     Pure; returns a new session plus a `ReadinessEffect` describing what changed
     so the UI can say "we backed off 7 % today".
2. **`src/core/progression/doubleProgression.ts`**
   - `nextLoad({ exercise, prescribedRange, loggedSets })` implementing §5.3,
     including bodyweight rep progression and the increment table.
   - Applied when generating the *next* occurrence of a T2/T3 exercise.
3. **`src/core/progression/mesocycle.ts`**
   - `evaluateMesocycle(program, loggedSets)` → per T1 exercise: the top-set
     result, the §5.2 verdict, the new training max, `consecutiveHolds`, and
     `forceSixWeekWave`.
   - `summariseBlock(program, loggedSets)` → completion %, total tonnage,
     sessions done, average readiness, average session duration, PR count.
4. **PRs** — `src/core/progression/prs.ts`: `detectPRs(loggedSets, existing)`
   for `e1rm`, `rep_max_3`, `rep_max_5`, `volume_set`. Called on session finish;
   new PRs are written and surfaced in the session summary
   ("New estimated 1RM on Back Squat: 132 kg").
5. **Pace calibration** — after 5 completed sessions compute
   `median(actual)/median(estimated)`, clamp 0.8–1.3, store as `pace_factor`,
   and use it in future estimates (`applyPaceFactor`).
6. **Pain flags** — logging a pain flag writes a `pain_flags` row with
   `active_until = today + 14 days`; the generator and `substitute()` respect it;
   after expiry the movement returns at 80 % load for its first occurrence.
7. **End of block** — `/plan` end-of-block card → **Start next block**:
   `evaluateMesocycle` → insert new `training_maxes` → generate the next program
   with the same seed family → show a "what changed" summary
   ("Squat TM 130 → 135 kg. Bench held — RPE was high.").
8. **`/history`** — three tabs:
   - **Sessions**: reverse-chronological, duration, readiness dot + word, completion %
   - **Lifts**: pick an exercise → estimated-1RM line chart over time
     (one chart library, one chart type) + a best-sets table
   - **PRs**: dated list, newest first
9. **Tests**
   - each §5.4 readiness band produces exactly the documented adjustment
   - each §5.2 row produces the documented TM change, including two-holds
   - double progression fires only when **every** set hits the top of the range
   - PR detection: a heavier 3-rep set that is a lower e1RM sets `rep_max_3` but not `e1rm`
   - pace factor clamps at both ends
   - an end-to-end **pure** test: fabricate 4 weeks of logs → evaluate → generate
     the next block → assert loads went up by the documented amount

## Acceptance criteria
- [ ] A low readiness score visibly reduces today's prescribed loads in the player.
- [ ] Finishing a block produces new TMs and a next program without re-onboarding.
- [ ] History shows real logged data with no fabricated points.
- [ ] Four green commands.

## Do NOT
- Do not invent extra progression models (no RPE-autoregulated percentages,
  no velocity, no fatigue formulas). The spec is the spec.
- Do not put progression maths in the UI or the repositories.

## Commit
`feat: close the loop with readiness, progression, PRs and history`
