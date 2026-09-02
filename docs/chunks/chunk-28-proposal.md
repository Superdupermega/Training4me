# Chunk 28 — The proposal

**Depends on:** chunk 25 (chat, infra) and chunk 26 (the `'tested'` TM
source, so a proposal discussing a training-max change can describe it
honestly — see `docs/11-COACH-PLATFORM.md §8`). Chunk 27 does not block
this one but should already be done per the runbook's stated order.
**Size:** L.
**Read first:** `docs/11-COACH-PLATFORM.md §4` and `§5` in full — this
chunk *is* the trust boundary those sections describe; read them twice.
`src/core/library/query.ts`'s `substitute`/`find`/`isPermitted`,
`src/server/actions.ts`'s `updateLiveProgram`, and
`src/core/builder/materializeRoutine.ts` — this chunk reuses validation and
mutation patterns from all three rather than inventing new ones.

This is the chunk that lets the coach change something. Everything about
its design is in service of one property: **a change only ever happens
because a validated, typed tool call said so, and only after the athlete
explicitly applied it.**

---

## 1. `src/core/coach/tools.ts` — pure, zod-first

The `propose_change` tool's argument schema, exactly the discriminated
union in `docs/11-COACH-PLATFORM.md §5`: `swap_exercise`, `adjust_sets`,
`adjust_load`. Define it as a `zod` discriminated union
(`z.discriminatedUnion('action', [...])`) — this is both the runtime
validator *and* the JSON schema handed to the Anthropic SDK's `tools`
parameter (check whether the SDK version pinned in chunk 25 can derive a
tool schema from a zod schema directly, or whether the JSON schema needs
writing by hand next to it and kept in sync by a test that round-trips a
few example payloads through both).

Export the union type from here (`ProposedChange`) — `applyProposal.ts`
and `src/server/coach/actions.ts` both import it, never redefine it.

## 2. `src/core/coach/applyProposal.ts` — pure

```ts
export function applyProposal(
  session: SessionRow, // must include .blocks and .status
  change: ProposedChange,
  ctx: LibraryContext, // the athlete's equipment/complexity settings — same shape src/core/library already uses
): SessionBlock[] // throws ProposalInvalidError on any violation
```

Validation, in order, each a distinct, testable failure:

1. `session.status !== 'planned'` → refuse. A session that's started,
   finished, or skipped never gets rewritten by a proposal — same
   invariant `updateLiveProgram` already respects for the athlete's own
   edits (`DECISIONS.md`, 2026-08-29 — "sessions that are finished, in
   progress, skipped, or holding logged sets are left untouched").
2. The named block/slot must exist in `session.blocks`.
3. `adjust_sets` on a block whose `kind === 'main'` → refuse outright,
   unconditionally — this is `01-METHODOLOGY.md §1.3`'s "never trim T1"
   rule, now enforced against the coach specifically, not just the
   time-budget trimmer. Write this as its own named error
   (`MainLiftProtectedError` or similar under `DomainError`) so a test can
   assert on it precisely rather than on a generic failure.
4. `swap_exercise`'s `toExerciseId` must resolve to a real `Exercise`,
   `isPermitted(exercise, ctx)` (equipment + complexity/`allowAdvanced`),
   and not already be the exercise in that slot. Reuse `isPermitted`
   directly — do not re-derive equipment/complexity logic here.
5. `adjust_load`'s `setNumber` must exist on that exercise's `sets` array;
   `percentTm`/`rpe` stay inside whatever bounds the generator itself
   respects (check `01-METHODOLOGY.md`'s RPE cap — "RPE cap 8.5" for T1,
   confirm the equivalent for whatever tier the targeted block actually
   is, and don't let a proposal exceed it either).

On success, returns a **new** `SessionBlock[]` (the input is not mutated)
with exactly the targeted slot/set changed — same "produce a fresh value"
discipline every other `src/core` function in this repo follows.

## 3. `src/server/coach/actions.ts`

```ts
export async function sendCoachMessage(text: string): Promise<Result<{ replyId: string }>>
```
— extends chunk 25's version: now passes `tools: [PROPOSE_CHANGE_TOOL]` to
`coachCompletion`, using `claude-sonnet-5` (not haiku) for this call per
`11-COACH-PLATFORM.md §2`. If the response includes a tool-call block:
parse its `input` through the zod schema (§1) — a parse failure means the
model produced something that doesn't fit the contract, and the reply is
stored as a **plain chat message with no proposal**, not a broken proposal
card (fail closed, not partially open). On successful parse, store the
assistant message with `proposal` set to the validated object and
`proposal_status: 'pending'`.

```ts
export async function applyCoachProposal(messageId: string): Promise<Result>
```
`requireUnlocked()` first. Loads the message, refuses if
`proposal_status !== 'pending'`. Loads the target session
(`repo.getSession`), calls `applyProposal` (§2) inside a try/catch —
a thrown `DomainError` becomes `{ ok: false, error: ... }`, the proposal's
`proposal_status` is left `pending` (not silently marked failed-and-gone;
the athlete can see why and ask again). On success: `repo.updateSession(id,
{ blocks: newBlocks })`, set `proposal_status: 'applied'`,
`revalidatePath('/program')` and `revalidatePath('/session/[id]', 'page')`
(or however this codebase already revalidates the session route — check
`updateLiveProgram`'s own revalidation calls and match them).

```ts
export async function dismissCoachProposal(messageId: string): Promise<Result>
```
Sets `proposal_status: 'dismissed'`. No mutation.

## 4. UI

`src/components/coach/ProposalCard.tsx` — rendered by the chat thread in
place of (or alongside, your call) the plain assistant text for any
message with a non-null `proposal`. Show it as a real diff, not a repeat of
the model's prose: exercise being swapped out → in with the session/day
it's on, or the set/load change stated as a number
("D2, set 3: 75% → 80%"), plus Apply / Dismiss buttons. A `pending`
proposal that's already been applied or dismissed on a page reload should
render its resolved state, not the buttons again — `proposal_status`
drives which UI shows, not local component state.

## 5. Tests

This chunk's tests matter more than its UI — this is the trust boundary.

- `tools.test.ts`: every example payload in `docs/11-COACH-PLATFORM.md §5`
  parses; a payload with an extra/wrong-typed field is rejected; an
  `action` value outside the three defined ones is rejected.
- `applyProposal.test.ts`, one test per validation rule in §2 above,
  named after the rule, each asserting the *specific* error thrown, not
  just "it throws":
  - refuses on a non-`planned` session,
  - refuses `adjust_sets` against a `main` block, unconditionally (this
    one gets its own explicit test — it's the rule most worth protecting),
  - refuses a swap to a non-existent exercise id,
  - refuses a swap to an exercise the athlete's `ctx` doesn't permit
    (wrong equipment, or `advanced` complexity without `allowAdvanced`),
  - refuses an out-of-range `adjust_load`,
  - a valid `swap_exercise` produces a new `SessionBlock[]` with exactly
    one exercise id changed and everything else byte-identical (assert the
    rest of the structure with a deep-equal minus the one field, not a
    loose shape check).
- `applyCoachProposal`/`sendCoachMessage`: `requireUnlocked` first;
  `applyCoachProposal` on an already-`applied`/`dismissed` message refuses
  without touching the session; a tool-call response that fails zod
  parsing is stored as prose-only, `proposal` stays `null` — write a test
  that feeds a deliberately malformed mocked tool-call response through
  `sendCoachMessage` and asserts exactly this.
- `verify:actions`: every new action isolated from `/unlock`, same as
  every chunk.

## Acceptance

- [ ] A `swap_exercise` proposal, once applied, changes exactly the target
      slot in `t4m_session.blocks`, nothing else — verified end-to-end
      with a real (or faithfully mocked) round trip.
- [ ] `adjust_sets` against a `main` block is refused, no exceptions,
      covered by a dedicated test.
- [ ] A proposal targeting a session that isn't `planned` is refused.
- [ ] The model cannot cause a mutation through prose alone — only a
      zod-valid tool call, applied explicitly, ever writes. Provable by a
      test, not just by design intent.
- [ ] `/program` reflects an applied swap; the next time that session is
      opened, the session player plays the new exercise (this specific
      claim needs a human with a phone per the runbook, but the code path
      — `revalidatePath` reaching both routes — is verifiable now).
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.

---

Commit message: `feat: chunk 28 — the proposal`
