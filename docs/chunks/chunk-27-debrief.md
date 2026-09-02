# Chunk 27 — The debrief

**Depends on:** chunk 25 (reuses `coachCompletion`, the cap check, the
message table). **Size:** M.
**Read first:** `docs/11-COACH-PLATFORM.md §0.2`, `§4` (context, not tools —
this chunk has no tool use), `§6` rule 4 (numbers must come from a database
row). `src/components/session/SessionSummary.tsx` and
`src/core/progression/retrospective.ts` (chunk 23) — the debrief sits next
to the PR moment that chunk already built, and reuses its own numbers
rather than recomputing them.

The session summary already shows what happened: sets, PRs, tonnage. This
chunk adds one sentence of *reaction* to it — generated, cached, and
grounded entirely in numbers the summary itself already has.

---

## 1. `src/core/coach/debrief.ts` — pure

```ts
export function buildDebriefContext(input: {
  session: SessionRow;
  loggedSets: LoggedSetRow[];
  prs: Pr[];
  previousSessionsSamePattern: SessionRow[]; // for "vs last time" framing, if any exist
}): string
```

Same shape as chunk 25's `context.ts`, scoped to one session: what was
prescribed vs. what was logged (sets completed, any skipped, any RPE ≥ 9.5
backoff that fired), PRs from this exact session, tonnage for the session.
Unit test it the same way — fixed input, assert every fact appears as a
substring, nothing invented.

## 2. `src/server/coach/actions.ts`

```ts
export async function generateSessionDebrief(sessionId: string): Promise<Result<{ text: string }>>
```

`requireUnlocked()` first. `isCoachConfigured()` — false means
`{ ok: false, error: 'not configured' }`, which the UI treats as "render
nothing," not an error banner (§4 below). Then:

1. Check `t4m_coach_message` for an existing `kind: 'debrief', session_id`
   row — if one exists, return its `content` directly. **Never regenerate
   a debrief that already exists** — this is the cost control that matters
   most here, since a debrief fires automatically (not on athlete request
   like chat) and a naive implementation would re-bill on every summary
   reload.
2. Otherwise: fetch the session, its logged sets, its PRs (`repo.listPRsForSession`
   already exists per `src/server/repo.ts`), build context via
   `buildDebriefContext`, call `coachCompletion({ kind: 'debrief', ... })`
   with the `haiku` model per `11-COACH-PLATFORM.md §2`, insert the result
   as `kind: 'debrief', session_id`, return it.

No tool use, no `tools` argument — a debrief is prose only.

## 3. UI

`src/components/session/SessionSummary.tsx` — a new card, positioned after
chunk 23's PR moment and before the set-by-set list (PRs are the bigger
moment; the debrief is commentary underneath it, not competing with it).
On mount (if `isCoachConfigured()` — pass this down as a prop from the
server component that already renders the summary, don't re-check
client-side): call `generateSessionDebrief` immediately, show a skeleton
(a single `Skeleton` line or two, not a spinner — this app doesn't use
blocking spinners elsewhere per `docs/04-DESIGN-SYSTEM.md`'s motion
language) while it's in flight, replace with the text once it resolves.
Absent entirely — no card, no skeleton — when the coach isn't configured.

Keep this a small client island the same way `SessionSummary.tsx`'s notes
field already is one; don't convert the whole summary to a client
component over this.

**The ~15 s target is a real acceptance criterion** (`RUNBOOK.md` item 5),
not a soft goal — if a manual timing check during this chunk's own
development shows it consistently missing that badly, say so in
`PROGRESS.md` with the actual number rather than shipping silently slow.

## 4. Failure and empty states

- Not configured → nothing renders (already covered above).
- Configured but the call fails (network, API error, over cap) → the card
  simply doesn't appear; log the failure server-side (whatever this app's
  existing client/server error logging does —
  `src/app/api/log-client-error/route.ts` exists for the client half) but
  do not show a broken-looking card or retry loop on a screen the athlete
  is trying to finish and move on from.
- A session with zero logged sets (fully skipped) → still worth a debrief
  ("skipped session" is real information a coach should react to), or
  explicitly decide not to generate one and say why in `DECISIONS.md` — a
  reasonable call either way, just make it deliberately.

## 5. Tests

- `debrief.test.ts`: fixed input → every fact present, PR-less session
  produces coherent output with no PR section leaking in.
- `generateSessionDebrief`: second call for the same `sessionId` returns
  the cached row and does **not** call `coachCompletion` again — the
  strong version of this test mocks/spies the completion function and
  asserts it was called exactly once across two invocations.
- Unconfigured path refuses before touching the DB write for a new
  message (reading the cache check is fine — writing a new debrief is
  not).

## Acceptance

- [ ] A finished, coach-configured session gets a debrief card within the
      chunk's own manual timing check, target ~15 s.
- [ ] Reloading the summary shows the same debrief, not a new one, and
      does not incur a second API call.
- [ ] Every claim in a debrief can be traced to a real logged number —
      spot-check by hand during this chunk against a couple of generated
      examples (mocked API response is fine for this check; the point is
      the *context string* fed to the model contains only real facts, not
      that the model's own prose is being graded).
- [ ] Unconfigured instance: zero card, zero network call, zero cost.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.
- [ ] `PROGRESS.md` notes `/session/[id]`'s summary-view bundle delta, if
      any real client JS was added beyond the existing notes-field island.

---

Commit message: `feat: chunk 27 — the debrief`
