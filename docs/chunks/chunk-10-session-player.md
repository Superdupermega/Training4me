# Chunk 10 — THE SESSION PLAYER (the screen that matters)

**Read first:** `docs/00-CONTEXT.md`, then `docs/04-DESIGN-SYSTEM.md §5.3, §6, §7`
and `docs/03-ARCHITECTURE.md §6, §7`.
**Depends on:** 07, 09. **Size:** L — has a split point.

## Mission
The screen the athlete uses with a barbell waiting. Local-first, offline-proof,
readable at arm's length, one thumb.

> **Split point.** Commit after PART A (`feat(ui): session player with set logging`),
> `/clear`, then run PART B (timer, offline, swap).

---

## PART A — structure and logging

1. **`src/app/(app)/session/[id]/page.tsx`** — server component: fetch the full
   nested session via `sessionRepo.getSession`, render `<SessionPlayer/>` with it.
2. **Readiness dialog** (`components/session/ReadinessDialog.tsx`) on first open:
   three M3 `Slider`s (sleep, soreness, stress, 1–5) + **Skip**. On submit calls
   `beginSession(id, readiness)`; the returned adjusted session replaces local
   state. Show the §5.4 message for the resulting band.
3. **`components/session/SessionPlayer.tsx`** — one client component, one
   `useReducer` over `PlayerState` in `player/reducer.ts` (pure, unit-testable):
   ```
   state: { session, currentBlockId, completedSets, outbox, startedAt, elapsed }
   actions: START | LOG_SET | EDIT_SET | SKIP_SET | NEXT_BLOCK | FINISH | REST_*
   ```
4. **Block accordion** — only the current block expanded; each header shows the
   letter, name and estimated minutes; completed blocks collapse with a tick.
5. **Exercise card** — slot letter, name, tempo chip, rest chip, the cue line.
6. **Set rows** — `Set 3 · 5 reps · 92.5 kg · @8`. Tap to expand an inline editor:
   - weight stepper ±2.5 kg (±1.25 with micro-plates), long-press to repeat
   - rep stepper ±1
   - RPE `ToggleButtonGroup` 6–10 (half steps 7.5/8.5/9.5)
   - a **pain** flag menu (knee/shoulder/lower-back/elbow/hip/other)
   - a big ✓ (≥ 56 dp) to complete
   Completing collapses the row, ticks it, and moves focus to the next set.
7. **Header** — elapsed time (from an absolute start timestamp), title,
   "≈ 52 min planned", overflow menu (finish early, skip session, notes).
8. **Bottom bar** — "Next block" until the last block, then "Finish session"
   → `finishSession` with actual seconds → summary → `/plan`.
9. **Tests** — reducer unit tests: logging a set marks it complete and queues an
   outbox entry; editing a logged set replaces, not duplicates; skipping a set
   doesn't count as volume; finishing computes elapsed correctly.

---

## PART B — timer, offline, substitution

10. **Rest timer** (`components/session/RestTimer.tsx`) — auto-starts on set
    completion, bottom sheet, `CircularProgress determinate` + `displaySmall`
    countdown, −15 s / +15 s / Skip. Driven by an **absolute end timestamp**
    plus `requestAnimationFrame`/interval, so backgrounding is safe. Vibrates
    on zero via `navigator.vibrate` when available. Respects
    `prefers-reduced-motion`.
11. **Wake lock** — request `navigator.wakeLock` while the player is mounted,
    release on unmount; degrade silently where unsupported.
12. **Offline** (`player/outbox.ts`) — `idb-keyval` queue:
    - cache the full session on open
    - every log appends `{ clientId, prescribedSetId, payload, clientLoggedAt }`
    - flush on `online`, on a 15 s interval, and on finish; upsert is idempotent
      on `prescribed_set_id`
    - a `Chip` shows "N sets queued" whenever the outbox is non-empty; it
      disappears when flushed
    - **Test with the network genuinely off**: log a full session offline,
      re-enable, confirm every set lands exactly once.
13. **Swap exercise** — overflow on the exercise card → a `Menu` listing
    `substitute()` candidates from `src/core` with the reason ("no rack",
    "knee flagged"). Calls `swapExercise`, re-runs `fitToBudget` server-side,
    and updates the displayed estimate.
14. **In-session autoregulation** (§5.5) — logging RPE ≥ 9.5 on a T1 working set
    drops the next set's suggested load 5 % with an inline note; twice → 10 %
    for the remainder and `autoregulated = true` on the session.
15. **Tests** — timer counts down correctly across a simulated backgrounding
    (mock `Date.now` jump); outbox flush is idempotent under a duplicated flush;
    autoregulation triggers at exactly 9.5 and not 9.0.

## Acceptance criteria
- [ ] A complete session can be logged **with the network disabled** and syncs
      afterwards with no duplicates and no lost sets.
- [ ] Rest timer stays accurate after 2 minutes with the screen off.
- [ ] Every interactive element is ≥ 48 dp; the complete-set tick ≥ 56 dp.
- [ ] Keyboard-only completion of a session is possible; `aria-live` announces completions.
- [ ] Logging a set feels instant (no await on the network in the tap path).
- [ ] Four green commands.

## Do NOT
- Do not compute progression or PRs here (chunk 11).
- Do not block the UI on any network call.
- Do not use `setInterval` counting for the timer.

## Commit (part B)
`feat(ui): add rest timer, offline logging queue and exercise substitution`
