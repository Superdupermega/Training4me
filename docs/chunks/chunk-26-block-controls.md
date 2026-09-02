# Chunk 26 — Block controls

**Depends on:** nothing (independent of chunk 25). **Size:** M.
**Read first:** `docs/00-CONTEXT.md`, `docs/PROGRESS.md` (latest entries),
`docs/11-COACH-PLATFORM.md` §4 and §6, `docs/01-METHODOLOGY.md` §5.1–§5.2.
Then this file.

Mission: three things an athlete can do to the block they are in — push it
back a week, deload next week, add a 1RM test week — as **pure engine
functions first**, server actions second, buttons third. Chunk 28 gives the
coach the same three actions as proposals; nothing here knows the coach exists.

Closes backlog items 3 and 5 from `docs/chunks/chunk-13-backlog.md`.

---

## 0. The prerequisite: stop hard-coding the peak week

`src/server/nextBlock.ts` decides which week's top set drives the training-max
roll-over with

```ts
const peakWeek = program.weeks === 4 ? 3 : 5;
```

That is true only while a block is exactly the wave's shape. The moment a
deload is inserted or a test week appended, it points at the wrong week and
every TM roll-over is silently wrong. **Fix this first, land it, and only
then build anything that can change a block's shape.**

New pure `src/core/progression/blockControls.ts`:

```ts
export interface ControlSession {   // the "outside view" reconcileProgram.ts uses, plus what these need
  id: string; weekNumber: number; dayNumber: number; weekday: number;
  scheduledDate: string; status: 'planned'|'in_progress'|'completed'|'skipped';
  hasLoggedSets: boolean; isDeload: boolean; archetype: Archetype;
  mainPattern: MovementPattern | null; blocks: SessionBlock[];
}
export function findPeakWeek(sessions: ControlSession[]): number | null
```

`findPeakWeek` returns the highest week number whose main blocks contain a
set with `kind === 'top'`; `null` if none (a routine-based block has no wave
and no peak — the existing behaviour for those must not change: check what
`rollOverTrainingMaxes` does today for `routine_id`-backed programs and
preserve it exactly). `rollOverTrainingMaxes()` uses it. The existing
roll-over tests pass **unchanged**; add one where a deload week sits between
the peak and the end.

Then the test-week rule, also here: `testWeekResults(sessions, logs)` → per
main exercise, the heaviest *successful* single logged in a `'TEST'`
session. When present, the roll-over uses `trainingMaxFromOneRepMax(single)`
for that lift instead of the peak-week verdict, with reason
"tested 1RM 142.5 kg → TM 127.5 kg". Test: a tested single overrides the
peak verdict; a failed attempt (reps 0 / skipped) does not.

## 1. Push the block back (`shiftSessions`)

```ts
export function shiftSessions(
  sessions: ControlSession[], fromDate: string, days: number,
): { id: string; scheduledDate: string }[]
```

- `days` must be a positive multiple of 7 — throw otherwise. Weekdays hold;
  the athlete's preferred days stay their days.
- Only sessions that are still a pure plan move: `status === 'planned' &&
  !hasLoggedSets` (reuse the exact predicate `reconcileProgram.ts` uses; if
  it is not exported, export it from there and import it — do not copy it).
  Only those with `scheduledDate >= fromDate`.
- Date maths via `date-fns` `addDays` on ISO strings; no `Date.now()`.
- Returns only the rows that change. Tests: nothing before `fromDate`
  moves; nothing with history moves; order and spacing are preserved; a
  14-day shift is two weeks, not one.

Server action `shiftBlock(days: 7 | 14)` in `actions.ts`: `requireUnlocked()`,
`fromDate = today(profile.timezone)`, apply the returned rows with
`repo.updateSession`, `revalidateTag` for sessions and program. The program's
`start_date` stays — it is history. If the reminder cron reads
`scheduled_date`, it keeps working by construction; check and say so.

## 2. Deload next week (`deloadWeek`)

```ts
export function deloadWeek(week: PlannedWeek, ctx: DeloadContext): PlannedWeek
```

Two cases, decided by the program's origin:

- **Generated block** (`routine_id` null): the block already has a
  template week (week 1 as stored) and a wave. Re-materialise the target
  week with `rematerializeWeek(templateWeek, weekNumber, weeks, dateFor,
  ctx, lib, rng)` forced onto the wave's deload row. `rematerializeWeek`
  takes the wave row from `weekNumber`; add an explicit optional
  `waveOverride?: WaveWeek` parameter rather than faking a week number.
  Use the program's frozen `input` (it is stored for exactly this — see
  `02-DATA-MODEL.md` §`t4m_program.input`) to rebuild `ctx` and `lib`, and
  a seeded `rng` from the same seed the generator used so the finisher
  rotation is reproducible.
- **Routine block** (`routine_id` set): no wave. `deloadTransform(blocks)`:
  main lift → 2 sets × 5 with `percentTm: 0.60` where the set was
  `percentTm`-based, else `weightKg × 0.8` rounded to `increment`, else
  (RPE-based) `rpe: 6`; secondary: one fewer set (min 1); superset: one
  fewer round (min 1), sets resized to match; finisher: keep only the
  aerobic exercise if there is one, else drop the block; primer and
  down-regulate unchanged. Then `fitToBudget`.

Both mark the week `isDeload: true` and every session `isDeload: true`.

**Where it goes:** "next week" = the first week after the current one whose
sessions are all still pure plans. The rewritten deload week takes that
week's slot; every later week shifts by +1 week number and +7 days
(`shiftSessions` on those, so nothing with history moves); `t4m_program.weeks`
grows by one. If the block's last week *is* the current week, the deload is
appended instead.

**Invariants, asserted in tests** — this is where the chunk earns its keep:
- `validateWeek(deloaded, …, 'invariants')` passes for a generated block.
- Every deloaded session's `estimatedSec` ≤ `sessionCapSec` (a deload comes
  in short by construction — prove it, do not assume it).
- No movement changes: the set of `exerciseId`s per session is identical
  before and after (finisher exempt, as it is in `rematerializeWeek`).
- Ramp sets are still `kind: 'ramp'` and still excluded from `totals`
  (the #14 regression case in `SessionPlayer.test.tsx` keeps passing).
- `findPeakWeek` on the result still finds the original peak.

Server action `deloadNextWeek()`: `requireUnlocked()`, compute with the pure
function, write with `reconcileProgram`'s vocabulary — delete-and-insert
only sessions in `replaceIds`, never touch `kept` — in one pass, then
`revalidateTag`. Check whether `persistProgram`/`updateProgramFromRoutine`
already has the "replace these session ids, insert these sessions" write;
if so, reuse it rather than writing a third one.

## 3. Add a test week (`testWeek`)

```ts
export function testWeek(templateWeek: PlannedWeek, ctx: TestWeekContext): PlannedWeek
```

- One session per main pattern in the template week, in the template's
  day order, on the template's weekdays. Archetype `'TEST'`: add it to
  `Archetype` in `src/core/types.ts` next to `'CUSTOM'` — **not** to
  `ARCHETYPES`, so every `Record<SessionArchetype, …>` in the generator stays
  exhaustive and never sees it. Title "Test: {lift}". `isDeload: false`.
- Blocks: the template's primer (unchanged) → one `main` block with a
  ramp ladder as `kind: 'ramp'` singles at 50/60/70/80/90 % of TM (rest
  90/120/150/180/240 s) and then three `kind: 'top'` singles prescribed at
  100 %, 103 %, 106 % of the *e1RM* the TM implies (TM / 0.9), each
  `rpe: 9.5`, rest 240 s, with the block `note` saying to stop at the first
  miss — → the template's down-regulate block. No secondary, no superset,
  no finisher. `fitToBudget` still runs; a test session is well under the cap.
- Only allowed after a deload week: the pure function takes `afterWeek`
  and throws if that week is not `isDeload`. The action and the UI enforce
  the same rule; the coach's proposal validation (chunk 28) will call this
  function and get the same answer.
- `t4m_program.weeks` grows by one; dates follow the deload week by +7.

The player already handles `kind: 'top'` and ramp sets; `RampLadder.tsx`
already renders a ladder. Check that a `'TEST'` session plays end-to-end in
`SessionPlayer.test.tsx` with a fixture — logging a top single, an RPE, and
finishing. Do not add a new player mode.

## 4. UI

`/program` gets an **Adjust the block** overflow menu (M3 `Menu` from the
existing `TopBar` action slot, or a `Card` of three `ListItemButton`s under
the week list — pick whichever the page already has room for and say which):

| Item | Copy in the `ConfirmDialog` |
|---|---|
| Push back a week | "Every session you have not started moves one week later. Finished and started sessions stay where they are. Nothing else changes." Offer 1 or 2 weeks. |
| Deload next week | "Next week becomes a deload — same movements, lighter and shorter. The rest of the block moves one week later. Your dates and everything you have trained stay." |
| Add a test week | "Adds one week after the deload: one session per main lift, warm up to a single, then three attempts. The best successful single sets your next training max." Disabled with a reason when the block has no deload week ahead. |

Each item calls its action, shows the existing snackbar/`Alert` pattern on
`ok: false`, and the page re-renders from revalidated data — no client state
holds the program.

Also on `/program`: a deload week's heading gets the existing deload
treatment; a test week's sessions show their `'TEST'` archetype as "Test
week" using `blockKindMeta`-style keyed metadata — extend the existing
archetype label map if there is one, do not add a parallel one.

## 5. Tests

Everything in §0–§3 is pure and gets direct unit tests. Plus:
- The matrix test (`src/core/generator/matrix.test.ts`) is **untouched and
  green** — nothing here changes generation.
- `rollOverTrainingMaxes` tests unchanged and green, plus the two new cases.
- A generated fixture block: shift → deload → test week, in sequence,
  asserting the invariants of §2 after each step and that `findPeakWeek`
  is stable throughout.
- Actions: each calls `requireUnlocked()` first (the existing pattern test
  for that, if there is one, gains three entries).

## Do not

- Do not change `WAVE_4` / `WAVE_6`, `prescriptionFor`, or the roll-over
  table in `nextTrainingMax`. A test week *feeds* the existing maths; it does
  not replace it.
- Do not add `'TEST'` to `ARCHETYPES`.
- Do not let any control touch a session that has history — the predicate
  is `reconcileProgram`'s, shared, not re-typed.
- Do not put any of this in `src/server` first and "extract later".

## Acceptance

- [ ] `findPeakWeek` replaces the hard-coded peak; roll-over tests unchanged and green.
- [ ] Shift / deload / test week are pure functions with direct tests; invariants of §2 asserted.
- [ ] A `'TEST'` session plays and finishes in the existing player; its single sets the next TM.
- [ ] `/program` offers all three behind confirmations, with the test week disabled when not allowed.
- [ ] Matrix test untouched and green.
- [ ] `02-DATA-MODEL.md` notes `'TEST'` in `archetype` and that `weeks` can now exceed 4/6 on a live program — `t4m_program.weeks` is `check 4 or 6` today and must be widened by a migration, applied and verified like chunk 25 §6.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.

**Commit:** `feat: chunk 26 — block controls (peak-week detection, shift, deload, test week)`
