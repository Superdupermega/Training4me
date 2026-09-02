# Chunk 25 — The coach, wired

**Depends on:** nothing in this phase — first chunk of v3. **Size:** L.
**Read first:** `docs/11-COACH-PLATFORM.md` in full (all nine sections —
this chunk builds §1, §2, §3, most of §4, and the chat half of §0). If a
`claude-api` skill or equivalent reference is available in this session,
load it before writing `src/server/coach/anthropic.ts` — pricing and model
ids drift and the plan document says explicitly not to trust its own
numbers blindly.

This is the foundation chunk: the data model, the cost metering, the
`ANTHROPIC_API_KEY`-absent gate, and a working (if simple) chat. Nothing in
here writes to a program. That's chunk 28.

---

## 1. Dependency

Add `@anthropic-ai/sdk` (pinned, exact version — same convention as every
other dependency in `package.json`). This is a real new dependency, not on
`00-CONTEXT.md §3`'s disallowed list (state library, ORM, CSS framework,
second component kit, second charting library) — record it in
`DECISIONS.md` anyway, since every dependency choice in this repo's history
is recorded, and note the exact version pinned and why (latest stable at
time of writing, unless there's a reason to pin older).

## 2. Migration

Two new tables, `t4m_coach_message` and `t4m_coach_usage`, exactly as
specified in `docs/11-COACH-PLATFORM.md §3`. RLS on, one permissive policy,
same as every existing `t4m_*` table — copy the pattern from a recent
migration rather than writing it from scratch. Apply it live
(`mcp__Supabase__apply_migration` against `cyberpunk-vibe01`), confirm with
`information_schema.columns`/`information_schema.tables`, the same
discipline chunk 23 used (`DECISIONS.md`, 2026-08-30). If it genuinely
cannot be applied this session, follow the runbook's blocked-migration
path — SQL into `PROGRESS.md` under *Blocked*, chat ships gated so it
renders nothing rather than half-built against a table that doesn't exist.

## 3. `src/server/coach/config.ts`

```ts
export function isCoachConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
```

Genuinely that simple — the point is one call site, not one env read
scattered across the codebase. Every other file in this chunk imports it
rather than reading `process.env.ANTHROPIC_API_KEY` directly.

## 4. `src/server/coach/anthropic.ts`

The one place that calls the Anthropic API. A single exported function,
something like:

```ts
export async function coachCompletion(args: {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  kind: 'chat' | 'debrief' | 'proposal';
  tools?: Anthropic.Tool[];
}): Promise<Result<{ text: string; toolUse?: { name: string; input: unknown } }>>
```

Internally: check `isCoachConfigured()` (defensive — every caller should
already have checked), check the cost cap (§5 below) *before* calling the
API, make the call with the model chosen by `kind` per
`11-COACH-PLATFORM.md §2`, record real usage via `src/server/coach/repo.ts`
after, and return `{ ok: false, error }` on any failure (network, API
error, over cap) rather than throwing — same `Result<T>` contract as every
other server-facing function (`00-CONTEXT.md §5`). This is the only file
in the coach feature that imports `@anthropic-ai/sdk`.

## 5. Cost caps

`src/core/coach/costCap.ts` — pure:

```ts
export function capCheck(
  spentTodayUsd: number,
  spentThisMonthUsd: number,
  dailyCapUsd: number,
  monthlyCapUsd: number,
): { allowed: boolean; reason?: 'daily' | 'monthly' }
```

`src/server/coach/repo.ts` supplies the two summed totals (a `sum(cost_usd)
where created_at >= <start of day|month in the athlete's timezone>` query
against `t4m_coach_usage` — reuse whatever timezone helper `repo.ts`
already uses elsewhere, e.g. `today(profile.timezone)`'s neighbours in
`src/core/dates.ts`) and reads `COACH_DAILY_CAP_USD`/`COACH_MONTHLY_CAP_USD`
from `process.env`, defaulting to `2`/`20` when unset. `anthropic.ts`'s
wrapper calls `capCheck` before every real request.

## 6. `src/server/coach/repo.ts`

Following the existing `src/server/repo.ts` conventions exactly (named
exports, `unstable_cache` with tags for reads, plain `async function` for
writes, domain types not raw rows):

- `insertCoachMessage(msg)` / `listCoachMessages(limit)` — most recent N
  first for display, but hand the model the chronological order; pick N
  (context-window trimming per `11-COACH-PLATFORM.md §7`) and record it.
- `recordUsage(entry)` — insert into `t4m_coach_usage`.
- `spentToday()` / `spentThisMonth()` — the two sums §5 needs.

New cache tag (`TAGS.coach` alongside the existing tags in `repo.ts`),
revalidated by every coach mutation.

## 7. `src/core/coach/context.ts`

Pure function turning already-fetched rows into a compact fact string —
**not** a database call itself (`11-COACH-PLATFORM.md §4`'s "no read tools"
rule). Something like:

```ts
export function buildCoachContext(input: {
  profile: Profile;
  activeProgram: ProgramRow | null;
  thisWeekSessions: SessionRow[];
  recentPrs: Pr[];
}): string
```

Producing plain, factual lines the system prompt is built from — training
maxes, days/week, current week number, sessions completed vs. planned this
week, the most recent 3–5 PRs with dates. Unit test it directly: given a
fixed input, the output contains every fact and no others (a snapshot-style
test that asserts specific substrings, not a loose "is non-empty" check).

`src/server/coach/actions.ts`'s `sendMessage` assembles this input from
`repo.getProfile()` / `repo.getActiveProgram()` / `repo.listSessions()` /
`repo.listPRs()` (all already exist) before calling `buildCoachContext`.

## 8. `src/server/coach/actions.ts`

```ts
export async function sendCoachMessage(text: string): Promise<Result<{ replyId: string }>>
```

`await requireUnlocked()` first. Then `isCoachConfigured()` — if false,
`{ ok: false, error: 'Coach is not configured.' }`. Then: insert the
athlete's message (`role: 'user', kind: 'chat'`), build context (§7),
assemble recent history (§6), call `coachCompletion` (§4), insert the
reply (`role: 'assistant', kind: 'chat'`), `revalidatePath('/coach')`.

No tool use yet — this chunk's chat is read-only conversation. Pass no
`tools` to `coachCompletion`. Chunk 28 adds `propose_change`.

## 9. `/coach`

`src/app/coach/page.tsx` — server component. If `!isCoachConfigured()`,
render the plain explanation from `11-COACH-PLATFORM.md §1`, nothing else.
Otherwise: render `listCoachMessages()` as a simple thread (most recent
last, athlete right-aligned or otherwise distinguished from the coach the
same restrained way the rest of this app distinguishes roles — no bubble
chrome library) and a `src/components/coach/MessageInput.tsx` client
component (a `TextField` + submit button calling `sendCoachMessage` via a
server action, matching the pattern `SessionSummary.tsx`'s notes field
already uses for a client island inside a server page). Keep this
component small and specifically client — the goal named in
`11-COACH-PLATFORM.md §8` is not paying for chat chrome JS on every other
route.

Nav: add "Coach" to whichever nav component lists the app's destinations
(`src/components/nav/`), gated on `isCoachConfigured()` — check it server
side where the nav shell is already rendered, don't ship the entry and hide
it with CSS.

## 10. Tests

- `costCap.test.ts`: under both caps → allowed; over daily → `daily`; over
  monthly (but under daily) → `monthly`; exactly at the boundary (pick and
  document whether the boundary itself is allowed or refused).
- `context.test.ts`: fixed input → every expected fact appears in the
  output string; a `null` active program produces something coherent
  (no "undefined" leaking into a prompt).
- `actions.test.ts` (or wherever this project's action-level tests already
  live, if it has a pattern for them — check first): `sendCoachMessage`
  calls `requireUnlocked` before anything else; refuses cleanly when
  `isCoachConfigured()` is false, without importing/calling the Anthropic
  SDK at all in that path (a spy/mock proving the API client was never
  constructed is the strong version of this test).
- `verify:actions` must still pass — `sendCoachMessage` (and every action
  this chunk adds) must not be reachable from `/unlock`.

## Acceptance

- [ ] `t4m_coach_message` and `t4m_coach_usage` exist live, RLS on, one
      permissive policy each, confirmed by direct query (not assumed from
      migration success).
- [ ] With `ANTHROPIC_API_KEY` unset: no nav entry, `/coach` still resolves
      and explains itself, every coach action refuses before any network
      call.
- [ ] With it set: a real message round-trips (only verifiable by a human
      with a real key per the runbook — code path must be correct and
      tested with the API call itself mocked).
- [ ] A call made once and over cap the next time is refused before any
      Anthropic request — provable by a test asserting the SDK client
      constructor/request function was not invoked on the refused path.
- [ ] `t4m_coach_usage` gets a real row, with real `input_tokens`/
      `output_tokens`/`cost_usd`, on every successful call.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.
- [ ] `PROGRESS.md` states `/coach`'s first-load JS in kB, next to this
      chunk's entry — the number chunk 29 may need to act on.

---

Commit message: `feat: chunk 25 — the coach, wired`
