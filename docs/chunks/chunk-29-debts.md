# Chunk 29 — Debts

**Depends on:** nothing. Run whenever a session has room; before chunk 28 if
`/coach`'s first-load JS came in over budget in chunk 25. **Size:** M.
**Read first:** `docs/00-CONTEXT.md`, `docs/PROGRESS.md` (chunks 14, 21, 22
and 24's bundle numbers), `docs/07-PRODUCTION-REVIEW.md` #22,
`docs/chunks/chunk-21-polish.md` §4, `docs/11-COACH-PLATFORM.md` §0.
Then this file.

Three independent items. Ship each green on its own.

---

## 1. The exercise library off the client (finding #22)

**The problem, measured.** `src/core/library/exercises/` is ~123 kB of source.
`ExerciseBrowser.tsx` and `ExercisePickerDialog.tsx` import all of
`EXERCISES`; `getExercise()` drags the whole `BY_ID` map into
`src/components/format.ts`, which nearly every client component imports
transitively. Result, from `next build`:

| Route | Budget (chunk 21 §4) | Last measured |
|---|---|---|
| `/session/[id]` | ≤ 170 kB | 234 kB |
| `/exercises` | ≤ 160 kB | 217 kB |
| `/program/builder` | ≤ 190 kB | 196 kB |

**Step 0 — measure first.** Run `pnpm build`, paste the route table for
these three plus `/today` and `/coach` into `PROGRESS.md` as the *before*.
Every number in this item is an observation, not a target to edit.

**Do.**
- Introduce `ExerciseLite` in `src/core/library/lite.ts` — `{ id, name,
  nameSv, pattern, tier, metric, loadable, unilateral, defaultTempo, cue,
  equipment, primaryMuscles, browseGroups }` — and `toLite(ex)`. This is
  what a client component may hold.
- **Session player:** `src/app/session/[id]/page.tsx` resolves every
  `exerciseId` in the session's blocks to `ExerciseLite` on the server and
  passes an `exercises: Record<string, ExerciseLite>` prop down. Every
  `getExercise()` call inside `src/components/session/**` becomes a lookup
  in that map. `format.ts` must stop importing the library: split the
  library-dependent helpers out of it into a server-only module, or make
  them take an `ExerciseLite`.
- **Exercise browser:** the server renders the filtered list (search,
  muscle group, equipment, style are URL search params already or become
  them); `ExerciseBrowser.tsx` keeps only the controls and receives the
  page of results as `ExerciseLite[]`. The detail page already server-renders.
- **Picker dialog:** loads on open. Either a server action
  `searchExercises(query, filters)` returning `ExerciseLite[]` (read-only
  public library data, so `requireUnlocked()` is not strictly needed — keep
  it in `actions.ts` anyway so the isolation check covers it), or
  `next/dynamic` of a module that imports the library only when the dialog
  mounts. The first is smaller; pick it unless typing latency on a phone
  argues otherwise, and say which in `DECISIONS.md`.
- **Builder:** the item editor and `MuscleCoverageStrip` need pattern and
  muscles for the items in the routine — resolve those server-side to a
  map the same way the player does.

**Guard it.** Add a test that fails if any file under `src/components/**`
or `src/app/**/*.tsx` marked `'use client'` imports from
`@/core/library/exercises` — a small script over the source tree in
`test/`, run by `pnpm test`. The rule is the deliverable; the numbers are
the proof.

**Step N — measure again.** Paste the *after* table. If any route is still
over its budget, say by how much and what remains (a blown budget is a
finding to report, not a number to edit). Do not touch
`docs/chunks/chunk-21-polish.md` §4.

## 2. Push reminders: make the missing configuration visible

`docs/09-PUSH-NOTIFICATIONS.md` needs a human to set `VAPID_PRIVATE_KEY` and
`CRON_SECRET` in Vercel. Until then `/profile/settings` lets the athlete
turn reminders on, saves the subscription, and nothing ever arrives — with
no indication why.

**Do.** `NotificationsCard.tsx` gets one server-rendered line from a new
read-only `isPushConfigured()` in `src/server/push.ts` (both env vars
present, trimmed, non-empty): "Reminders are set up on the server" or
"Reminders are not set up on the server yet — see docs/09". The toggle
still works either way (the subscription is worth saving now for later).
No secret value is ever rendered or logged; only the boolean.

Add the same boolean to the cron route's JSON when it refuses for a missing
`CRON_SECRET`, so a manual `curl` per `docs/09` step 3 says *why* it did
nothing.

## 3. The docs every session reads first

`docs/00-CONTEXT.md` was corrected alongside this plan (stack versions,
layout, branch, PIN gate, DoD). Verify it against the tree once more at the
end of this chunk and fix anything the chunks since have moved:

- §4 layout lists every real top-level route and module, including
  `src/app/coach`, `src/app/api/coach`, `src/core/coach`,
  `src/server/coach` if chunks 25–28 have landed.
- §3 table matches `package.json` versions to the major.
- §6's command is the full five-part one.
- README's *Layout* block matches `src/app`.

Also: `docs/RUNBOOK.md` *What you review as the human* gets the two
device-only checks no agent can do — the rest-timer notification while
backgrounded (`DECISIONS.md` 2026-08-30) and a real session debrief on a
phone — so they stop being invisible.

## Tests

- The client-import guard from §1, and it must fail before the refactor
  and pass after (run it both ways and say so).
- `SessionPlayer.test.tsx`, `SetRow.test.tsx`, builder and browser tests
  pass with the `ExerciseLite` prop shape — update fixtures, not assertions.
- `isPushConfigured()`: env present / absent / whitespace.

## Do not

- Do not remove exercises, rename ids, or change `inGeneratorPool` while
  moving the library. The matrix test and the 93-pool tripwire stay green.
- Do not edit the budgets.
- Do not add a bundle-analyzer dependency; `next build`'s route table is
  the measurement, as chunk 14 established.

## Acceptance

- [ ] Before/after route table in `PROGRESS.md`; any remaining overage explained.
- [ ] No `'use client'` file imports the full library — guarded by a test.
- [ ] Player, browser, picker and builder work from `ExerciseLite` maps; existing tests green.
- [ ] `/profile/settings` says whether reminders are configured server-side; no secret rendered.
- [ ] `00-CONTEXT.md`, README layout and `RUNBOOK.md` match the tree.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.

**Commit:** `chore: chunk 29 — library off the client, push-config visibility, docs kept true`
