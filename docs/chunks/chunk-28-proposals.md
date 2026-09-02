# Chunk 28 — Proposals

**Depends on:** chunks 25, 26, 27. **Size:** L.
**Read first:** `docs/00-CONTEXT.md`, `docs/PROGRESS.md` (entries for 25, 26,
27 in full), `docs/11-COACH-PLATFORM.md` §1 (the rule), §3.2, §3.7 and §6.
Then this file. Then the tool-runner section of the SDK docs (`claude-api`
skill → TypeScript `tool-use.md` and `streaming.md`), because the exact
runner API is not to be guessed.

Mission: the coach can *look things up* and *propose changes*. A proposal is
a typed object, validated by pure code, shown as a card, applied only by the
athlete's tap through the same server actions the buttons use. **The coach
never applies anything.** If you find yourself writing a path where a tool's
`run` mutates a program, session, set or training max, stop — that is the
one thing this plan forbids.

---

## 0. Proposal types (`src/core/coach/proposals.ts`, pure)

```ts
export const PROPOSAL_KINDS = ['swap_exercise', 'set_training_max', 'shift_week', 'deload_next_week', 'add_test_week'] as const;
export type Proposal =
  | { kind: 'swap_exercise'; sessionId: string; blockLetter: string; slot: string; fromExerciseId: string; toExerciseId: string; reason: string }
  | { kind: 'set_training_max'; exerciseId: string; fromKg: number; toKg: number; reason: string }
  | { kind: 'shift_week'; days: 7 | 14; reason: string }
  | { kind: 'deload_next_week'; reason: string }
  | { kind: 'add_test_week'; reason: string };
export const ProposalSchema: z.ZodType<Proposal>;     // one discriminated union; the tools reuse its members
export interface ValidationContext { … }              // sessions (ControlSession[]), profile bits, TMs, pain flags, equipment, cap, library ctx
export interface Validation { ok: boolean; reasons: string[]; preview?: string }
export function validateProposal(p: Proposal, ctx: ValidationContext): Validation
```

Rules, each a named check with its own test:

| Kind | Must hold |
|---|---|
| `swap_exercise` | Target session is a pure plan (`reconcileProgram`'s predicate — shared, not re-typed). `to` exists in the library or in `t4m_custom_exercise`. Same `pattern` as `from`, or listed in `from.alternatives`. `isAvailable(to, equipment)`. Not contraindicated by an active pain flag. After the swap: `validateWeek(week, …, 'invariants')` passes and `estimateSession(recost(session))` ≤ cap. A swap in a `main` block keeps the block's sets (percentages carry; the TM resolves through `resolveTrainingMax`'s anchor). |
| `set_training_max` | `exerciseId` has a current TM. `toKg` within ±10 % of `fromKg`, rounded to the increment (`roundToIncrement`), `> 0`. Never *up* when the last peak-week or test verdict for that lift was a miss (read from the last `tm_changes`). |
| `shift_week` | `days ∈ {7, 14}`. At least one session would move. |
| `deload_next_week` | Chunk 26's precondition: a future week of pure plans exists, or the current week is the last. Not already a deload. |
| `add_test_week` | Chunk 26's precondition: a deload week ahead; no test week already present. |

`preview` is a one-line human rendering ("Bench press → Dumbbell bench press
in Thursday's session, block C") used on the card. Pure, tested.

## 1. Tools (`src/server/coach/tools.ts`)

Defined with `betaZodTool`, every one `strict`-shaped (zod object,
`.strict()`, all fields required or explicitly nullable). Two families:

**Read tools** (execute immediately, return text):
- `get_exercise_history(exerciseId)` → `historyForExercise()` rendered
  compactly: date, top set, e1RM, last 12 occurrences.
- `search_exercises(query, pattern?, muscleGroup?)` → up to 10 matches from
  the library plus custom exercises: id, name, pattern, equipment,
  unilateral, `contraindications`. This is how the coach finds a valid swap
  target instead of guessing an id.
- `get_session(sessionId)` → the planned blocks and any logged sets, the
  same rendering `renderSessionContext` (chunk 27) produces.

**Propose tools** (do not mutate — validate and persist a *proposal*):
- `propose_swap_exercise`, `propose_training_max`, `propose_block_change`
  (`{ kind: 'shift_week' | 'deload_next_week' | 'add_test_week', days?, reason }`).
  Each `run`: build the `Proposal`, load a `ValidationContext` (parallel
  reads, all cached already), `validateProposal`, insert a
  `t4m_coach_proposal` row with `status: ok ? 'proposed' : 'rejected'` and
  the validation, and return to the model a short text: the preview and
  either "Proposed — the athlete will see a card to apply it" or "Rejected:
  {reasons}". A rejected proposal is still stored and still shown, greyed,
  so the athlete sees what the coach wanted and why the engine said no.

Tool descriptions say plainly that proposing does not apply, that the
athlete decides, and that `search_exercises` must be used to find ids.

## 2. The loop

`askCoach` (chunk 25) gains `tools` and switches to
`client.beta.messages.toolRunner({ …, tools, stream: true, max_iterations: 6 })`.
Read `streaming.md`'s *Streaming with Tool Use* example and follow it
exactly: outer loop over runner iterations, inner loop over each stream's
events, `text_delta` piped to the response, `finalMessage()` per iteration
for usage. Sum usage across iterations into the one `chat_assistant` row.
`tool_choice` stays `auto`. If an iteration ends with `stop_reason:
'pause_turn'`, push the assistant content back as the docs show; if it
ends with `refusal`, stop as chunk 25 does. Check `stop_reason` of the last
message before trusting the loop ended cleanly.

When a proposal is created during a turn, the client needs to know. Two
acceptable shapes: (a) the client re-fetches "proposals created after my
last message id" through a read-only server action when the stream ends;
(b) the stream ends with a trailer line that starts with the ASCII
record-separator byte (0x1E) followed by the proposal ids — a byte the
model will never emit in prose. Pick one, record it in `DECISIONS.md`, and
make sure the plain-text stream stays readable if the client ignores it.
(a) is simpler and needs no parsing; prefer it.

## 3. Applying

Server action `applyProposal(id)` in `src/server/actions.ts`:
1. `await requireUnlocked()`.
2. Load the row; `status` must be `'proposed'` — anything else returns
   `ok: false` with "already applied / dismissed / rejected".
3. **Re-validate** with a fresh context (the block may have changed since).
   Fail → `status: 'rejected'`, return the reasons.
4. Apply through existing code only:
   - `swap_exercise` → the session's `blocks` rewritten with the new
     exercise (`tempo`, `cue` from the library; sets kept; `substitutedFrom`
     set) via `repo.updateSession`, then `recost`. This is the same shape
     `applyAutoregulation`/`addSet` already write.
   - `set_training_max` → `repo.setTrainingMaxes({ [id]: toKg }, 'manual', today)`.
   - `shift_week` / `deload_next_week` / `add_test_week` → chunk 26's actions.
5. `status: 'applied'`, `resolved_at`, `result` (what changed, for the
   card), `revalidateTag` for what moved.

`dismissProposal(id)` sets `status: 'dismissed'`. Both are idempotent:
a second call returns `ok: false` and changes nothing (tested).

## 4. UI

- `/coach`: a `ProposalCard` per proposal, inline in the thread at the
  message it belongs to: kind icon, `preview`, `reason`, and either
  **Apply** / **Dismiss** (proposed), the rejection reasons (rejected), or
  the result (applied). Apply confirms with the existing `ConfirmDialog`
  using the same copy chunk 26 wrote for block controls, and the swap /
  TM copy in the same voice ("Bench press becomes Dumbbell bench press in
  Thursday's session. Nothing else changes.").
- `/today`: if any `proposed` rows exist, the `CoachCard` says "1 proposal
  waiting" and links to `/coach`. Server-rendered, no JS.
- Applied proposals show a chip on `/program` on the affected session
  ("changed by coach proposal") reading `substitutedFrom` / the proposal
  row — no new column on `t4m_session`.

## 5. Migration

`t4m_coach_proposal` per `11-COACH-PLATFORM.md` §3.7, `service_role`-only,
applied and verified like chunk 25 §6, recorded in `02-DATA-MODEL.md`.

## 6. Tests

- `validateProposal`: a matrix — for each kind, one passing case and one
  failing case per rule in §0's table. Include: swap to a different pattern
  (reject), swap to an `alternatives` entry of a different pattern
  (accept), swap into a session with logged sets (reject), swap that pushes
  the session over the cap (reject — build the fixture at the cap), TM +12 %
  (reject), TM up after a missed peak (reject), test week without a deload
  ahead (reject).
- Tools: each `propose_*` `run` inserts exactly one row and never calls a
  mutating repo function (spy on `updateSession`, `setTrainingMaxes`, and
  the chunk-26 actions — assert zero calls).
- `applyProposal`: applies once, second call `ok: false`; re-validation
  failure flips the row to `rejected` and mutates nothing.
- The loop: mocked runner yielding two iterations (one tool call, one text
  reply) — the stream carries the text, one `chat_assistant` row is written
  with summed usage.
- Existing tests for `applyAutoregulation`, `addSet`, chunk 26's actions and
  the matrix are untouched and green.

## Do not

- No tool `run` mutates training data. Ever.
- No `tool_choice` other than `auto`. No `temperature`. No `thinking` param.
- No auto-apply "for low-risk kinds". There are no low-risk kinds.
- Do not add a `t4m_session` column for provenance; `substitutedFrom` and
  the proposal row are enough.
- Do not let the client send proposal payloads to `applyProposal` — it sends
  an id; the server holds the payload.

## Acceptance

- [ ] `validateProposal` covers every rule with a passing and a failing test.
- [ ] Propose tools persist and never mutate (spied).
- [ ] Apply re-validates, applies through existing actions, is idempotent.
- [ ] Cards render all four statuses; `/today` counts waiting proposals.
- [ ] A rejected proposal is visible with its reasons.
- [ ] With the API mocked, a full turn produces text, a proposal row and one usage row.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.

**Commit:** `feat: chunk 28 — coach proposals (read tools, validated proposals, apply through existing actions)`
