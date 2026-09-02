# 11 — THE COACH PLATFORM (v3)

**Status:** ready to execute. **Written:** 2026-09-02, against commit `0298c2e`.
**Audience:** the implementing agent. Read this file top to bottom once, then
run `docs/chunks/chunk-25…29` in order, one per session, per `docs/RUNBOOK.md`.

v1 was *a program generator that logs* (chunks 01–13). v2 made it *a training
app you own* — five destinations, a 300-movement library, a builder, an
analysis view (chunks 14–21) — and v2.5 made it *feel* right (chunks 22–24).
The app is complete as a tool. What it is not yet is a **platform for one
athlete's training over years**: something that reads the log back, tells you
what it saw, and helps you steer the next block. That is this phase.

Three things, in order:

1. **A coach that reads your log.** A Claude-backed coach with the whole
   training history in front of it: it answers questions, writes a short
   debrief after every session, a review every week and a retrospective every
   block — and, when you ask, *proposes* concrete changes it is never allowed
   to apply on its own.
2. **Block controls** the athlete (and the coach) can pull: push the block back
   a week, deload now, add a 1RM test week. These are pure engine functions
   first, buttons second, coach tools third.
3. **The debts** that would otherwise keep compounding under the new work:
   the exercise library shipped to every client bundle, and the docs every
   session reads first having drifted from the code.

---

## 0. Where the app stands — read before assuming anything is missing

Everything below exists, is tested, and is live at https://training4me.vercel.app.
Re-building any of it is the main way this plan can be wasted.

| Area | What exists | Where |
|---|---|---|
| Engine | Deterministic generator, 150-combination matrix test, time budget, balance rules B1–B10, 4/6-week waves, TM roll-over, readiness and in-session autoregulation | `src/core/` |
| Library | ~300 movements, muscle taxonomy, pattern glyphs, `inGeneratorPool` tripwire | `src/core/library/` |
| Builder | Routine → `SessionBlock[]` materialiser, live-program reconcile (finished sessions survive edits) | `src/core/builder/`, `src/server/routines.ts` |
| Player | Focus + list views, typed-in weights that carry over, offline outbox keyed `(session, block, slot, set)`, rest timer with next-set preview, plate bar, PR moment, on-the-fly sets | `src/components/session/` |
| Analysis | e1RM series, weekly volume, body map, consistency + streak, heatmap, block retrospective | `src/server/analytics.ts`, `src/components/profile/`, `src/app/program/complete/` |
| Data | 14 `t4m_*` tables, RLS `service_role`-only, JSON/CSV export, bodyweight, session notes, `tm_changes` | `docs/02-DATA-MODEL.md` |
| Security | PIN gate in Edge middleware **and** `requireUnlocked()` as the first statement of every mutating action; `/unlock` isolation verified by `pnpm verify:actions` | `src/middleware.ts`, `src/server/authGuard.ts` |
| Ops | CI gate (lint, typecheck, test, build, verify:actions), Vercel `arn1` next to Supabase `eu-north-1`, push reminders wired but waiting on two secrets | `.github/workflows/`, `docs/09-PUSH-NOTIFICATIONS.md` |

Tests: 401 at chunk 24, a few more since. All green.

**Open debts, carried in from earlier reviews** (each is a chunk item here or
explicitly left alone in §7):

- Route first-load JS is over the chunk-21 budgets on the three heaviest
  routes because the whole exercise library is imported into client
  components (`docs/07-PRODUCTION-REVIEW.md` #22). → chunk 29.
- `rollOverTrainingMaxes()` finds the peak week as `weeks === 4 ? 3 : 5`.
  That is only true while a block's shape is exactly the wave's. → chunk 26
  must fix it before anything can change a block's shape.
- Push reminders need `VAPID_PRIVATE_KEY` and `CRON_SECRET` set by a human in
  Vercel. Not a code item. → chunk 29 makes the missing configuration visible
  in the UI instead of silently doing nothing.
- The rest-timer notification's real backgrounded behaviour is unverified
  (`DECISIONS.md` 2026-08-30). A human with a phone has to do this; it is in
  `RUNBOOK.md`'s review list, not in any chunk.
- `docs/00-CONTEXT.md` had drifted from the code (stack versions, layout,
  branch, no mention of the PIN gate). Fixed alongside this plan, since every
  chunk prompt begins by reading it.

---

## 1. The one rule of this phase

> **The coach proposes. The core disposes.**

The language model never writes a program, a session, a set or a training max.
It reads a **dossier** (a compact, deterministic rendering of the athlete's
state that pure code builds), it talks, and when it wants to change something
it emits a **typed proposal**. A proposal is validated by pure functions in
`src/core` — the same balance rules, time budget and TM maths every other path
already obeys — and applied only when the athlete taps *Apply*, through the
same server actions the buttons use. If validation fails, the proposal is
shown as rejected with the reason, and nothing changes.

What this buys, concretely:

- The 150-combination matrix, the 60-minute promise, "one main lift per
  session", "pull ≥ push" — none of it can be talked out of.
- Everything the coach can do, a button can do. The coach is a second
  producer of *intents*, exactly as the builder is a second producer of
  `SessionBlock[]` (`docs/06-REDESIGN-PLAN.md` §3). No path exists that only
  the coach can take.
- The app must work with the API down, unconfigured or over budget. Every
  coach surface degrades to *absent* — never to a spinner that blocks
  finishing a session.
- `src/core` stays pure. `@anthropic-ai/sdk` is banned from it by the same
  ESLint rule that bans Supabase (chunk 25 adds the entry).

---

## 2. What the athlete gets

| Moment | Today | After this phase | Chunk |
|---|---|---|---|
| Finish a session | Summary, PR moment, notes field | + a three-line **debrief** that arrives a few seconds later: what happened vs. the plan, what to watch next time, a flag if something looks like fatigue or pain | 27 |
| Open the app on Monday | Week N of M, streak | + **Review last week** — one tap, one paragraph, wins and concerns, the focus for the week ahead | 27 |
| Finish a block | Retrospective numbers | + the coach's reading of the retrospective, in words, next to the TM changes | 27 |
| Any time | — | **/coach**: ask anything about your training with the whole log in context — "why did my bench stall", "what should I do with a sore elbow this week", "is my pull/push balance ok" | 25 |
| Something has to change | Edit the routine, or restart from week 1 | **Block controls**: push everything back a week (travel, illness), deload next week, add a 1RM test week after the deload | 26 |
| The coach thinks something should change | — | It **proposes** a swap, a TM change or a block control as a card with Apply / Dismiss. Apply goes through validation; nothing happens silently | 28 |
| Every page | 234 kB on `/session/[id]` | The library stays on the server; clients get what they render | 29 |

**Not a chat app.** The structured UI stays primary. The coach is reachable
from the moments above; it is not a sixth navigation destination (M3 bottom
navigation tops out at five, and five is full — `docs/06-REDESIGN-PLAN.md`
§4). `/coach` is a full-screen route with its own back button, like the
player and the builder.

---

## 3. Architecture

### 3.1 Modules

```
src/core/coach/
  dossier.ts        buildDossier(input) → Dossier ; renderDossier(d) → string   [pure]
  prompts.ts        SYSTEM_PROMPT (frozen), task prompts                          [pure]
  proposals.ts      Proposal types + zod schemas, validateProposal(p, ctx)       [pure, chunk 28]
src/core/progression/
  blockControls.ts  shiftSessions, deloadWeek, testWeek, findPeakWeek            [pure, chunk 26]
src/server/coach/
  client.ts         lazy Anthropic client, isCoachConfigured(), COACH_MODEL
  spend.ts          cost per call, daily/monthly caps, coachSpendSince()
  dossier.ts        loads repo/analytics rows → buildDossier → renderDossier
  ask.ts            chat: streams, persists, tool loop (chunk 28)
  debrief.ts        session debrief, weekly review, block review (structured)   [chunk 27]
  proposals.ts      persist/apply proposals via existing actions                [chunk 28]
src/app/coach/      the full-screen chat route
src/app/api/coach/  POST route handler that streams the answer
```

### 3.2 Data flow

```
repo + analytics rows ──▶ buildDossier() ──▶ renderDossier() ──▶ ┐
                             [core, pure]                        │
SYSTEM_PROMPT (frozen, cache_control) ───────────────────────────┼──▶ Claude
athlete's question / task prompt ────────────────────────────────┘      │
                                                                        ▼
                                             text (chat) ─────────▶ stream to UI, persist
                                             structured JSON ─────▶ zod parse, persist
                                             tool call: propose_* ▶ validateProposal() [core]
                                                                          │ ok → t4m_coach_proposal (status: proposed)
                                                                          │ fail → rejected + reason, shown as such
                                                        athlete taps Apply ▶ applyProposal() ▶ existing server actions
```

Nothing to the right of *Claude* touches `t4m_program`, `t4m_session`,
`t4m_training_max` or `t4m_logged_set` except the final step, which is the
same code path a button takes.

### 3.3 The dossier

The dossier is the coach's entire view of the athlete. It is built by pure
code from domain types so it is testable, deterministic and cheap to reason
about. Contents, in this order (stable order matters for caching):

1. Profile: experience, days/week, session cap, equipment profile, bodyweight
   trend (last 8 weigh-ins, delta), timezone, today's date (passed in).
2. Training maxes with source and effective date; last block's `tm_changes`.
3. Active program: name, weeks, current week, sessions this week with status,
   whether it is generated or routine-based, deload/test weeks if any.
4. Last 12 sessions: date, title, readiness, main lift prescribed vs. logged
   (top set weight × reps @ RPE), skipped/autoregulated flags, athlete notes.
5. Per main pattern: e1RM now vs. 8 weeks ago, best set in the last 90 days.
6. Structural balance this week: pull/push, hinge/squat, unilateral, carry —
   straight from `countWeek()` in `src/core/generator/balance.ts`.
7. Consistency: sessions/week planned vs. done over 8 weeks, streak.
8. Active pain flags. PRs in the last 90 days.

Budget: **≤ 4 000 tokens rendered** — a test pins the fixture rendering under
a character ceiling. Numbers are kg, seconds and dates; no prose. Athlete-
authored text (session notes, custom exercise names) is placed under a
heading that says it is the athlete's own notes — it is data, not
instruction, and the system prompt says so.

### 3.4 Model and API settings

| Setting | Value | Why |
|---|---|---|
| Model | `claude-opus-5` | The default; one model, one cache namespace. Do not downgrade for cost — the whole phase costs a few dollars a month (§3.6). |
| Thinking | omit the `thinking` parameter | Adaptive is the default on this model. Never send `budget_tokens`, `temperature`, `top_p` or `top_k` — all rejected with a 400. |
| Effort | `output_config.effort`: `medium` for chat and debriefs, `high` for proposals | Debriefs are short and fact-bound; proposals need to be right. |
| `max_tokens` | 8 000 chat (streamed), 2 000 debrief/review (structured, short by schema) | The system prompt asks for short answers; the ceiling is a safety net, not a target. |
| Caching | `cache_control: { type: 'ephemeral' }` on the system block; dossier after it | The system prompt is frozen text; the dossier changes per request. Verify `usage.cache_read_input_tokens > 0` on the second call in a session and record it. |
| Structured output | `client.messages.parse` + `zodOutputFormat` (`@anthropic-ai/sdk/helpers/zod`) for debriefs; `strict: true` on every custom tool | The debrief is stored as JSON and rendered by the app, never as free text. If the installed SDK's zod helper rejects zod 4, hand-write the JSON schema for `output_config.format` and parse with zod yourself — do not downgrade zod. |
| Tools | `client.beta.messages.toolRunner` with `betaZodTool`, `stream: true`, `tool_choice` left at `auto` | Chunk 28 only. Forced tool choice is not needed and not portable. |
| Refusals | Check `stop_reason === 'refusal'` before reading content; show "the coach could not answer that" and persist nothing | Vanishingly unlikely for training talk, but it must not surface as a crash. Enabling server-side fallbacks is optional; record the choice in `DECISIONS.md` either way. |
| Streaming | Chat streams through a Route Handler; debriefs are non-streaming `parse` calls | Server Actions cannot stream. |
| Prefill | never | Removed on this model family. |

Exact SDK names and shapes come from the SDK's own documentation, never from
memory. The `claude-api` skill, if the session has it, is the reference; the
SDK repository README otherwise. Chunk 25 §0 spells this out.

### 3.5 Secrets and boundaries

- `ANTHROPIC_API_KEY` is read server-side only, in `src/server/coach/client.ts`.
  Never `NEXT_PUBLIC_`. Never in the repository (it is public). Set in Vercel
  for production and in `.env.local` locally, exactly like `SUPABASE_SECRET_KEY`.
- Without the key, `isCoachConfigured()` is false and every coach surface
  renders nothing or a one-line "coach not configured" — the app is otherwise
  unchanged. CI builds with no key.
- The chat route handler and every coach server action call
  `await requireUnlocked()` first — the same rule as every other mutation.
  The route handler returns `401` on failure, as the export routes do.
- `/unlock` must never import a coach module. `pnpm verify:actions` guards
  the action side; keep the route handler out of anything `/unlock` renders.
- The athlete's training data leaves the app and goes to Anthropic's API when
  a coach feature is used. Single athlete, their own data, their own key —
  but write it in the README plainly so it is a known fact, not a surprise.

### 3.6 Cost, and the guard that makes it a non-issue

One athlete, four sessions a week. Rough per-call figures with the dossier
at ~3 500 tokens and the system prompt cached:

| Call | Input (uncached + cached) | Output | ≈ cost |
|---|---|---|---|
| Chat turn | 4 000 + 1 500 | 400 | $0.03 |
| Session debrief | 4 000 + 1 500 | 250 | $0.03 |
| Weekly review | 4 500 + 1 500 | 400 | $0.03 |
| Proposal turn (tools) | 6 000 + 1 500 | 800 | $0.06 |

A month of real use — 16 debriefs, 4 reviews, 1 retrospective, ~60 chat turns
— lands around **$3–4**. The guard exists for the failure case (a loop, a
runaway), not the normal one:

- Every call's `usage` is stored on its `t4m_coach_message` row with a
  computed `cost_usd`.
- `COACH_DAILY_CAP_USD` (default `2.00`) and `COACH_MONTHLY_CAP_USD` (default
  `20.00`), read from env with those defaults. Over cap → the call is refused
  before it is made, with copy that says so and when it resets. Debriefs and
  reviews skip silently; chat says why.
- Debriefs run at most once per session, reviews once per ISO week, block
  reviews once per program — enforced by unique indexes, not by hoping.

### 3.7 Data

Two new tables, both `service_role`-only like every other `t4m_` table:

**`t4m_coach_message`** (chunk 25, extended 27): `id`, `thread_id` (uuid,
chat only), `kind` (`chat_user` | `chat_assistant` | `debrief` |
`weekly_review` | `block_review`), `session_id` / `program_id` / `week_start`
(nullable, whichever applies), `content jsonb` (text for chat, the parsed
schema for the rest), `model`, `input_tokens`, `output_tokens`,
`cache_read_tokens`, `cache_write_tokens`, `cost_usd numeric(8,4)`,
`created_at`. Unique partial indexes: one `debrief` per `session_id`, one
`weekly_review` per `week_start`, one `block_review` per `program_id`.

**`t4m_coach_proposal`** (chunk 28): `id`, `message_id` FK nullable, `kind`
(`swap_exercise` | `set_training_max` | `shift_week` | `deload_next_week` |
`add_test_week`), `payload jsonb`, `validation jsonb` (`{ok, reasons[]}`),
`status` (`proposed` | `applied` | `dismissed` | `rejected`), `created_at`,
`resolved_at`, `result jsonb`.

Migrations are applied the way chunk 23 did it: through the Supabase tooling
available to the session, verified afterwards with an `information_schema`
query, SQL recorded in `docs/02-DATA-MODEL.md`. If no tooling can reach the
project, the SQL goes into `PROGRESS.md` as a blocker for the human — the
code still ships behind `isCoachConfigured()` and a table-exists check, not
half-applied.

---

## 4. Block controls — the engine side (chunk 26)

Three operations on the block you are in. They are pure functions over the
program's sessions first; the UI and the coach both call the same server
actions.

| Control | Pure function | What it does | What it never does |
|---|---|---|---|
| **Push back a week** | `shiftSessions(sessions, fromDate, days)` | Every not-started, never-logged session dated ≥ `fromDate` moves by `days` (a multiple of 7, so weekdays hold). | Touch a session with history. Reorder anything. |
| **Deload next week** | `deloadWeek(week, ctx)` | Rewrites next week as a deload: generated blocks use the wave's deload row via `rematerializeWeek`; routine blocks use a `deloadTransform` (main → 2×5 @ 60 % TM or ×0.8 fixed weight; secondary −1 set; superset rounds −1, min 1; finisher → aerobic only; primer/down-regulate unchanged). The remaining weeks shift by one; the block grows by one week. | Change movements. Break `validateWeek(…, 'invariants')`. Exceed the cap (a deload comes in short by construction — assert it). |
| **Add a test week** | `testWeek(templateWeek, ctx)` | One extra week after the deload: per main pattern, a session that is primer → ramp-to-a-top-single (50/60/70/80/90 % singles, then attempts) → down-regulate. Archetype `'TEST'`, added to `Archetype` (not `ARCHETYPES`, so the generator's exhaustive tables stay exhaustive). | Add accessories. Count ramp singles as working sets. |

**The prerequisite:** `rollOverTrainingMaxes()` must stop assuming the peak
week is week 3 or 5. New pure `findPeakWeek(sessions)`: the week whose main
blocks carry a `kind: 'top'` set; a test week, when present and logged, wins
over it (TM = tested single × 0.90, rounded down to 2.5 kg — the existing
`trainingMaxFromOneRepMax`). Tests for both. This must land before any
control can change a block's shape, and the existing roll-over tests must
still pass unchanged.

UI: an **Adjust the block** menu on `/program`, each item behind the existing
`ConfirmDialog` with copy that says exactly what will move and what will not.

---

## 5. Chunks, order, sizes

| # | Chunk | Delivers | Depends on | Size |
|---|---|---|---|---|
| 25 | **Coach foundation** | SDK, dossier (pure), system prompt, spend guard, `t4m_coach_message`, streaming chat at `/coach`, Today entry point | — | M–L |
| 26 | **Block controls** | `findPeakWeek`, shift / deload / test week (pure + actions + UI); roll-over uses the new peak detection | — | M |
| 27 | **Debriefs and reviews** | Session debrief after finish (off the critical path), weekly review, block review; all structured, all shown in the existing surfaces | 25 | M |
| 28 | **Proposals** | Coach tools: read tools + `propose_*`; `validateProposal` in core; proposal cards; `applyProposal` through existing actions | 25, 26, 27 | L |
| 29 | **Debts** | Library off the client bundles with before/after numbers; push-config visibility; 00-CONTEXT and README kept true | — | M |

```
25 ──┬── 27 ──┐
     │        ├── 28
26 ──┴────────┘
29 (independent — run whenever, but before 28 if /coach's bundle is over budget)
```

25 and 26 are independent and can run in either order. 29 is independent of
everything and can be slotted wherever a session has room. 28 is last because
it needs all three of dossier, block controls and the structured-output
plumbing to exist.

Each chunk: fresh session, `/clear`, the `RUNBOOK.md` prompt, ends green,
committed and pushed, `PROGRESS.md` appended, deviations in `DECISIONS.md`.

---

## 6. Risks and how each is contained

| Risk | Containment |
|---|---|
| The coach states a number that is not in the log | The dossier is the only source of numbers and the system prompt says so. Debriefs are structured with every number typed; chunk 27's tests feed a fixture and assert the output only cites weights that appear in it. |
| A proposal breaks a rule the generator would have refused | `validateProposal` runs `validateWeek`, `recost`/`estimateSession` against the cap, equipment availability, pain contraindications and TM bounds (±10 %, never up after a missed peak set). Same functions, same tests, extended. |
| The API is down or slow and a session cannot be finished | Debriefs are scheduled with `after()` from `next/server` **after** `finishSession` has returned; the summary shows a debrief card that polls a few times and gives up quietly. Nothing awaits the API on the critical path. Asserted by a test that makes the client throw. |
| Cost runaway | §3.6: per-row usage, daily and monthly caps checked before every call, unique indexes on debrief/review rows. |
| Athlete notes read as instructions | Notes sit in a labelled dossier section; the system prompt names them as athlete-authored data. One athlete, own data — the realistic risk is a confused answer, not an exploit, but the boundary is still drawn. |
| The chat bundle blows `/today`'s 130 kB budget | `/today` gets a server-rendered card with a link. The chat client component lives on `/coach` only and is `next/dynamic`. Report the numbers; do not edit the budgets. |
| `src/core` gains an I/O dependency | ESLint `no-restricted-imports` gains `@anthropic-ai/sdk` for `src/core/**` (chunk 25). `pnpm lint` fails on violation. |
| Block controls corrupt a program mid-flight | Every control goes through `reconcileProgram`'s definition of history (started, finished, skipped or holding logged sets = untouchable). `findPeakWeek` replaces the hard-coded week before any shape change is possible. |
| A migration half-applies | Applied and verified with an `information_schema` query in the same session; SQL recorded in `02-DATA-MODEL.md`; code gated on `isCoachConfigured()` so a missing table cannot take down a page. |

---

## 7. Deliberately not doing

Recorded so a later agent does not "helpfully" add them.

- **Letting the coach apply anything.** Not even "small" things. §1 is the
  whole design; an auto-applied TM change would be the first crack in it.
- **A chat-first UI.** The coach is reachable from moments in the existing
  UI. Nothing structured is replaced by a text box.
- **A sixth navigation destination.** Five is the M3 ceiling and the current
  five are right. `/coach` is full-screen like the player.
- **Voice or camera input.** Out of scope for a phone in a gym with sweaty
  thumbs; the typed weight rule (README, *During a session*) stays.
- **Nutrition, sleep tracking, wearables, Apple Health / Google Fit.** Backlog
  #9 stays open. Bodyweight is already tracked and is enough context for the
  coach.
- **Multi-user, accounts, sharing a coach thread.** Single athlete,
  permanently, per `docs/10-FEEL-AND-POLISH.md`.
- **Alternate block templates (backlog #4), warm-up pinning (#6), Swedish UI
  strings (#8).** Still open, still valid, still not this phase. The coach
  can *suggest* a mobility drill in words; pinning one into every primer is a
  generator feature for another day.
- **A second LLM provider or a model switch for cost.** One model. §3.6.
- **Fine-tuning, RAG over the methodology doc, embeddings.** The methodology
  fits in the system prompt. The log fits in the dossier. There is nothing to
  retrieve.

---

## 8. Definition of done for the phase

- [ ] Chunks 25–29 landed, each with its own green run of
      `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions`.
- [ ] With `ANTHROPIC_API_KEY` unset, the app is indistinguishable from
      today except for one-line "not configured" notes where the coach would be.
- [ ] With it set: a session finished on a phone shows a debrief within
      ~15 s; `/coach` answers a question citing a number from the log; a
      proposal card can be applied and the change shows on `/program`.
- [ ] `findPeakWeek` replaces the hard-coded peak week and the roll-over
      tests are unchanged and green.
- [ ] `/session/[id]`, `/exercises`, `/program/builder` first-load JS
      reported before and after chunk 29, against the chunk-21 budgets.
- [ ] README has a *The coach* section: what it does, what data leaves the
      app, the env var, the caps.
- [ ] `docs/00-CONTEXT.md` describes the app that exists.
