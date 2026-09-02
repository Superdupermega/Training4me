# 11 — THE COACH (v3)

Chunks 25–29 in `docs/chunks/`. This document is the *why* and the shared
rules; the chunk files are the executable briefs.

**This does not change `00-CONTEXT.md §1`'s "one user = one athlete."** The
coach is a feature *for* that one athlete — an opinionated training partner
that reads their own log and talks back — not a multi-tenant coaching
product serving many athletes from one account. No teams, no client
management, no other person's data ever enters this app. `00-CONTEXT.md`'s
line is amended in this pass to say so explicitly, because "not a coaching
platform" read literally would rule out the thing this phase builds; the
distinction is *who the coach serves*, not whether one exists.

---

## 0. What the coach actually does

Three surfaces, three chunks:

1. **Chat** (`/coach`, chunk 25) — ask it anything about your own training.
   It reads your profile, program, recent sessions and PRs before every
   reply; it never invents a number that isn't in `t4m_logged_set` or
   `t4m_pr`.
2. **The debrief** (chunk 27) — a short "coach's take" card on the session
   summary, generated automatically when you finish a session, gone within
   ~15 s of opening it. Same no-invented-numbers rule.
3. **Proposals** (chunk 28) — the chat can suggest a concrete change ("swap
   Bulgarian split squat for walking lunges Thursday") as a structured
   card with Apply/Dismiss, not a paragraph you have to interpret and go
   make yourself. Applying it rewrites the live program the same way
   `updateLiveProgram` already does.

Chunk 26 (test week) and chunk 29 (guardrails/bundle) are not chat features
— 26 is a periodization gap the coach's debrief would otherwise have to lie
about ("your squat max probably went up" is not a sentence this app
should ever generate), and 29 hardens what 25/27/28 ship. See §7 for why
they're in this plan at all.

---

## 1. What ships with no `ANTHROPIC_API_KEY`

Same shape as `VAPID_PRIVATE_KEY` (`docs/09-PUSH-NOTIFICATIONS.md`) and
`APP_PIN` (`src/middleware.ts`): **absence is a supported state, not an
error state.** `src/server/coach/config.ts` exports `isCoachConfigured()` —
one `!!process.env.ANTHROPIC_API_KEY` check, called everywhere a coach
surface would otherwise render.

- Nav does not show a "Coach" entry when unconfigured — checked in the
  server component that renders the nav shell, not hidden with CSS.
- `/coach` itself still resolves (a direct link must not 404) and renders a
  plain explanation instead of a chat box: what it is, and that
  `ANTHROPIC_API_KEY` needs setting.
- The session summary's debrief card is simply absent — no skeleton, no
  "coach unavailable" apology taking up space for a feature you didn't turn
  on.
- Every coach server action checks `isCoachConfigured()` itself, in
  addition to whatever calls it — an action is a public endpoint regardless
  of what the UI shows, same reasoning as `requireUnlocked()` below.

`COACH_DAILY_CAP_USD` (default 2) and `COACH_MONTHLY_CAP_USD` (default 20)
have defaults and don't need setting; `ANTHROPIC_API_KEY` has none and must
be set for any of this to exist at all.

---

## 2. Cost — the caps are enforced, not advisory

Every real Anthropic call is preceded by a Postgres read (today's and this
month's summed `cost_usd` from `t4m_coach_usage`, §4) and followed by an
insert recording what it actually cost, computed from the response's real
`usage.input_tokens`/`usage.output_tokens` against a small per-model price
table — never estimated from prompt length. Over cap, the action returns
`{ ok: false, error }` before the network call is made, and the UI shows it
plainly ("Coach is resting for today — back tomorrow" / "...back next
month"), not a generic failure.

**Confirm real per-token pricing against Anthropic's own docs at the time
chunk 25 is executed** (the `claude-api` skill, if available in that
session, has current numbers) rather than trusting a figure written into
this plan on a different day — prices change and a stale constant makes
the cap either too generous or needlessly tight.

**Model choice**, cheapest capability that fits each job:
- Chat and the debrief: `claude-haiku-4-5-20251001`. Both are read-heavy,
  short-context, low-reasoning-load jobs — an opinion about a training log,
  not a proof.
- Proposals (chunk 28's tool-calling turn): `claude-sonnet-5`. Getting a
  swap wrong against the five product constraints (`00-CONTEXT.md §1`) is
  worse than the price difference; this is the one call worth paying more
  for.

Record the actual constants chosen (and the source you checked them
against) in `DECISIONS.md` when chunk 25 lands — this section states
intent, not a promise the numbers are still current.

---

## 3. Data model additions

Same convention as every `t4m_*` table (`docs/02-DATA-MODEL.md §3`): RLS
enabled, one permissive `for all to anon, authenticated using (true)`
policy, no `user_id`. Single athlete, same as everything else.

### `t4m_coach_message`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `role` | `text` | `user` \| `assistant` |
| `kind` | `text` | `chat` \| `debrief` — a debrief is written by the server on session finish, never by the athlete typing |
| `content` | `text` | the rendered reply/message text |
| `session_id` | `uuid` FK → `t4m_session`, nullable | set on `kind = 'debrief'`; also settable on a chat message that was asked *about* a specific session |
| `proposal` | `jsonb` nullable | present only on an assistant message whose reply included a validated tool call — the parsed, zod-checked args, never raw model output (§5) |
| `proposal_status` | `text` nullable | `pending` \| `applied` \| `dismissed` — null when `proposal` is null |
| `created_at` | `timestamptz` | default `now()` |

Index: `(session_id)` where not null (debrief lookup by session, so a
reload reads the cached debrief instead of regenerating and re-billing
it); `(created_at)` for chat history ordering.

### `t4m_coach_usage`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `created_at` | `timestamptz` | default `now()` |
| `kind` | `text` | `chat` \| `debrief` \| `proposal` |
| `model` | `text` | the exact model id used |
| `input_tokens` / `output_tokens` | `int` | from the API response, never estimated |
| `cost_usd` | `numeric(8,4)` | computed at insert time from the price table |

Index: `(created_at)` — both cap checks are a `sum(cost_usd) where
created_at >= <start of day|month, athlete's timezone>` range scan.

### `t4m_training_max.source` gains `'tested'`
Chunk 26 only. Find wherever the existing five values (`entered_1rm` \|
`estimated_epley` \| `progressed` \| `manual` \| `default`) are enforced —
a Postgres `check` constraint per `02-DATA-MODEL.md §1`'s convention — and
widen it in the same migration that the test-week feature needs. No other
column changes.

Every migration in this phase: additive, nullable where new, applied via
`mcp__Supabase__apply_migration` against the live `cyberpunk-vibe01`
project and confirmed with a direct `information_schema` query afterwards
— chunk 23 already established this is possible in this environment
(`DECISIONS.md`, 2026-08-30); don't assume it isn't available and gate the
feature unnecessarily. If it genuinely isn't reachable in a given session,
follow the runbook's blocked-migration path (SQL into `PROGRESS.md`,
feature gated so nothing renders half-built) rather than skip the chunk.

---

## 4. Architecture — where the boundary actually is

```
src/core/coach/         ← pure. no fetch, no Anthropic SDK, no Supabase.
  context.ts              shapes the facts (not prose) a call is grounded in
  tools.ts                zod schemas for every tool the model may call
  applyProposal.ts        (validated proposal, current session blocks) -> new SessionBlock[]
  costCap.ts              (usage totals, caps) -> { allowed, remainingUsd }
src/core/progression/
  testWeek.ts              chunk 26, pure — builds the test week, reads test results into TMs

src/server/coach/       ← server-only, same rules as the rest of src/server
  config.ts                isCoachConfigured()
  anthropic.ts              the one place that calls the Anthropic API
  repo.ts                   t4m_coach_message / t4m_coach_usage reads+writes
  actions.ts                sendMessage, generateDebrief, applyProposal, dismissProposal

src/components/coach/   ← chat UI, proposal card, debrief card
src/app/coach/           /coach route
```

**The trust boundary is `src/core/coach/tools.ts` and `applyProposal.ts`,
not the prompt.** A system prompt asking the model to "only propose safe
changes" is a request, not a guarantee — models are steerable by whatever
text they're shown, including a training note the athlete themselves wrote
weeks ago and forgot was in there. Nothing the model says in prose is ever
executed. The only thing that can change the program is a tool-call whose
arguments parse against a `zod` schema in `tools.ts` *and* pass
`applyProposal`'s own domain checks (exercise exists and is permitted for
this athlete's equipment/complexity settings, target block is never
`kind: 'main'`, target session hasn't started) — the exact same checks
`src/core/generator` and `src/core/builder` already apply to their own
output, reused, not reinvented. `applyProposal` throws a `DomainError`
subclass on any violation; the action layer turns that into a `Result`
the same way every other action does (`00-CONTEXT.md §5`).

This is why proposals are chunk 28 and not chunk 25: the boundary needs to
exist and be tested before anything can call it.

`src/core/coach/context.ts` exists for the mirror reason on the *read*
side — it turns real rows (profile, active program summary, this week's
adherence, recent PRs, the session just finished for a debrief) into a
compact fact list handed to the model in the system prompt. **The model
never has read access of its own** — no tool-based lookups, no multi-turn
agentic loop pulling more data mid-conversation. One call in, one call out,
grounded entirely in what the server already looked up. This is what keeps
latency inside the debrief's ~15 s budget and keeps "every number it states
must be one you logged" (the runbook's own review criterion) mechanically
true rather than hoped-for: the model cannot state a number it wasn't
given, and it's given only numbers that came out of the database.

---

## 5. Tool schema (chunk 28 defines these; named here so 25's chat and 27's
debrief don't paint themselves into a shape that can't hold them)

One tool, `propose_change`, a discriminated union on `action`:

- `swap_exercise` — `{ sessionId, blockLetter, slot, toExerciseId, reason }`.
  `applyProposal` resolves the *from* exercise itself (whatever is
  currently in that slot) and validates `toExerciseId` the same way
  `src/core/library/query.ts`'s `substitute()` already does — permitted by
  equipment/complexity, not the athlete's own excluded pattern.
- `adjust_sets` — `{ sessionId, blockLetter, slot, sets }` (an integer
  delta or an absolute count — pick one, record which in `DECISIONS.md`).
  **Refused outright when the target block's `kind === 'main'`** — the
  same "never trim T1" rule the time-budget engine already enforces
  (`01-METHODOLOGY.md §1.3`), now enforced against the coach too.
- `adjust_load` — `{ sessionId, blockLetter, slot, setNumber, percentTm? ,
  rpe? }` — retargets one prescribed set's intensity, not its exercise or
  count.

Not in scope for this phase: adding or removing a whole block, changing
the split/skeleton, touching a session that's `in_progress` or
`completed`, touching training maxes directly (that stays
`rollOverTrainingMaxes`'/chunk 26's job, never the coach's). A tool call
targeting any of those is a validation failure, not a special case the
model gets to negotiate.

---

## 6. Rules that apply to every chunk in this phase

Everything in `10-FEEL-AND-POLISH.md §3` still applies (core stays pure,
`t.vars.palette`, `requireUnlocked()` first, `/unlock` isolation, no second
reduced-motion mechanism). In addition:

1. **No coach surface renders, and no coach action does real work, without
   `isCoachConfigured()` returning true.** Check it in the UI *and* at the
   top of every action — the same defence-in-depth as `requireUnlocked()`.
2. **Every real API call is metered before it's made and recorded after.**
   No code path calls `src/server/coach/anthropic.ts` without first
   checking the cap and after inserting into `t4m_coach_usage`. One
   wrapper function that does both, called by every action — not each
   action reimplementing the check.
3. **The model never mutates anything directly.** Every write path is
   Result-returning application code in `src/core/coach/applyProposal.ts`
   and `src/server/coach/actions.ts`, exercised by an explicit
   athlete-initiated Apply, never by the reply arriving.
4. **Numbers the coach states must come from a database row.**
   `src/core/coach/context.ts` is the only source of facts handed to a
   prompt; if a debrief or reply needs a number that isn't already
   computed somewhere in `src/core`/`src/server`, compute it there first,
   pure and tested, the same as every other number this app has ever
   shown — do not let the model estimate one under it.
5. **A locked-out or unconfigured instance costs nothing.** No background
   job, cron, or effect calls the Anthropic API on a schedule; every call
   is a direct response to something the athlete did (opened a chat, sent
   a message, finished a session). Chunk 29's rate limit exists for abuse,
   not to replace this.

---

## 7. Deliberately not doing

- **No streaming.** A single request/response per turn is enough for a
  short reply and keeps the client bundle and the failure modes simple;
  revisit only if real latency on the debrief misses its 15 s target by a
  wide margin (chunk 27's own acceptance criterion is the trigger, not a
  guess made now).
- **No voice, no images, no file upload into the chat.** Text in, text and
  one structured proposal out.
- **No autonomous multi-step agent loop.** One call, grounded in
  server-assembled context, optionally containing one tool call. Nothing
  here calls itself again to "think more" — see §4.
- **No coach memory beyond the message log.** `t4m_coach_message` already
  is the memory; there is no separate summarization/vector-store layer.
  With one athlete and a growing-but-bounded log, trimming to the most
  recent N turns (chunk 25 picks N) is enough context management.
- **No personas, no configurable tone/system-prompt editing by the
  athlete.** One voice, consistent with how the rest of this app already
  talks (the README's own tone is the reference).
- **Test week (chunk 26) does not replace `rollOverTrainingMaxes()`'s
  inferred verdict for lifts that weren't tested.** A test week is
  opt-in and covers only the T1 lifts the athlete actually attempts;
  everything else still rolls over the existing way.

---

## 8. Order and why

**25 and 26 in either order** — genuinely independent. 25 is the chat
surface, infra, caps, and data model; 26 is a periodization feature with
no dependency on the coach existing at all (a test week is useful even
with no `ANTHROPIC_API_KEY` set). Both must land before 27 and 28, which
build on 25's infra (27 reuses the metering wrapper and message table for
debriefs; 28 reuses the chat surface and, per §4, needs 26's `'tested'` TM
source to exist so a debrief can correctly describe *why* a training max
just moved when it came from a test week rather than an inferred verdict).

**27 before 28.** The debrief is the simpler generation shape (no tool
use, no apply step) and exercises the metering/context/config plumbing
25 built without also exercising the mutation boundary — a good place to
find a broken cap check or a leaking cost before proposals start writing
to the live program on top of it.

**28 last of the four chat chunks.** It is the one chunk that can change
what the athlete actually trains next, and it depends on §4's boundary,
§5's schema, and 26's `'tested'` source (to describe a training-max move
honestly if a debrief runs after a test week) all already existing.

**29 is independent** — cost-cap/rate-limit hardening and `/coach`'s client
bundle weight, neither of which depends on the chat, debrief, or proposal
features being feature-complete first. Run it whenever a session has
spare room; run it **before 28** specifically if chunk 25's own
`PROGRESS.md` entry reports `/coach`'s first-load JS over whatever budget
`04-DESIGN-SYSTEM.md`/`10-FEEL-AND-POLISH.md`'s route-budget convention
implies — building the proposal card and Apply flow on top of an
already-bloated bundle just means paying to split it twice.

---

## 9. What only a human can verify

Same category as `docs/09-PUSH-NOTIFICATIONS.md`'s manual steps and the
runbook's own phone-only checks — recorded as unverified until done, not
assumed:

- A real chat exchange, on a phone, reading naturally.
- The debrief actually appearing within ~15 s of a real finished session,
  and every number in it checked against what was actually logged.
- A real proposal — ask for a swap, apply it, confirm `/program` reflects
  it and the next session plays the new exercise.
- The daily/monthly cap actually refusing a call once hit (cheapest way to
  check without waiting a day for real usage: temporarily set
  `COACH_DAILY_CAP_USD=0` locally and confirm the refusal message, then
  unset it — do not leave a temporary cap committed).
