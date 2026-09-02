# Chunk 27 — Debriefs and reviews

**Depends on:** chunk 25. **Size:** M.
**Read first:** `docs/00-CONTEXT.md`, `docs/PROGRESS.md` (chunk 25's entry in
full), `docs/11-COACH-PLATFORM.md` §2, §3.4, §3.6 and §6. Then this file.

Mission: the coach speaks without being asked — a short debrief after every
session, a review every week, a reading of the retrospective at the end of a
block. All three are **structured** (typed JSON the app renders), all three
are **off the critical path**, all three are **once only**.

---

## 0. Shape shared by all three

One function shape in `src/server/coach/debrief.ts`:

```ts
async function generate<T>(opts: {
  kind: 'debrief' | 'weekly_review' | 'block_review';
  key: { sessionId?: string; weekStart?: string; programId?: string };
  schema: z.ZodType<T>;
  taskPrompt: string;          // from src/core/coach/prompts.ts
  extraContext: string;        // rendered by a pure function, like the dossier
}): Promise<T | null>
```

1. `isCoachConfigured()` else return `null`.
2. `assertUnderCaps()`; on `CoachOverBudget` return `null` (debriefs are
   silent about budget — chat is where the athlete is told).
3. Already generated for this key? Return the stored row's `content`. The
   unique partial indexes from chunk 25 back this; a race that loses the
   insert reads the winner instead of throwing.
4. `client.messages.parse({ model: COACH_MODEL, max_tokens: 2000,
   output_config: { effort: 'medium', format: zodOutputFormat(schema) },
   system: [SYSTEM_PROMPT with cache_control], messages: [dossier turn,
   'Understood' turn, { role: 'user', content: taskPrompt + extraContext }] })`.
   If `zodOutputFormat` is unavailable for the project's zod version,
   pass a hand-written JSON schema to `output_config.format` and parse the
   text with the same zod schema — do not downgrade zod, do not hand-parse.
5. `stop_reason === 'refusal'` or `parsed_output` null → return `null`,
   persist nothing, log once.
6. Insert the row with `content`, usage and cost. Return it.

Every number the schema carries is typed (`number`, kg), never a string
with units. The renderers format.

## 1. Session debrief

**Schema** (`src/core/coach/schemas.ts`, pure, exported for tests):
```ts
{
  headline: string,            // ≤ 120 chars — "Bench moved: 5×5 at 82.5 kg, all under RPE 8"
  observations: string[],      // 1–3, each ≤ 200 chars, each citing at least one number from the session
  watch: string | null,        // one thing for next time, or null
  flag: 'none' | 'fatigue' | 'pain' | 'technique' | 'readiness',
}
```

**Extra context** — `renderSessionContext(session, logged, lastTime)` in
`src/core/coach/dossier.ts`: prescribed vs. logged per movement (top set
weight × reps @ RPE), readiness sliders, `autoregulated`, `actualSec` vs
`estimatedSec`, skipped sets, pain flags raised, PRs from this session, the
athlete's notes (under the same labelled heading), and *last time* for each
movement from `exerciseContext()`'s already-computed shape. Pure; tested.

**Trigger** — in `finishSession` (`src/server/actions.ts`), **after** the
existing work has produced its `Result`, schedule the debrief with
`after()` from `next/server`:

```ts
after(() => generateSessionDebrief(sessionId).catch(logOnce));
```

`finishSession`'s return value and timing must be unchanged. A test makes
the coach client throw and asserts `finishSession` still returns `ok: true`
and the session is still `completed`. A second test asserts the debrief
function is invoked at most once for the same session (second call hits
the stored row).

**Display** — `SessionSummary.tsx` gains a `DebriefCard` under `PRMoment`:
a small client component that calls a new read-only server action
`getSessionDebrief(sessionId)` on mount and then at 3 s, 6 s and 12 s, and
after that renders nothing at all (not "no debrief", not a spinner —
nothing). `/history`'s session view shows the stored debrief when present.
`flag !== 'none'` renders as a chip drawn from roles that already exist in
`theme.ts` — `error` for `pain`, `tertiary` for `fatigue` and `readiness`,
`secondary` for `technique`. There are no readiness-specific palette roles
(`10-FEEL-AND-POLISH.md` §4 decided against them); do not add any.

**Budget:** `/session/[id]` is already over its 170 kB budget for a known
reason (the library — chunk 29). `DebriefCard` is a few hundred bytes;
report the number, do not grow it further with anything else.

## 2. Weekly review

**Schema:** `{ summary: string (≤ 400), wins: string[] (0–3), concerns: string[] (0–3), focus: string (≤ 200) }`.

**Key:** `weekStart` = the ISO Monday of the week *being reviewed* (last
week), from `isoWeekStart()` in `src/server/analytics.ts` with the profile's
timezone. One per week.

**Trigger:** on demand, never automatic. `/today` shows **Review last week**
as a button on the existing consistency line when (a) the coach is
configured, (b) at least one session was completed in the previous ISO
week, and (c) no `weekly_review` row exists for that `weekStart`. Tapping it
calls `generateWeeklyReview()` (a server action: `requireUnlocked()` first),
then the page re-renders with the review in a card. Once generated, the
card shows until the next Monday, then the button returns for the new week.

**Extra context:** the previous week's sessions with the same per-session
summary as §1 uses, plus `countWeek()` for that week and the consistency
numbers. Pure renderer; tested.

## 3. Block review

**Schema:** `{ summary: string (≤ 600), tm_commentary: { exerciseId: string, text: string (≤ 160) }[], next_block: string (≤ 300) }`.

**Key:** `programId`. One per completed program.

**Trigger:** on demand from `/program/complete` — a **What the coach saw**
button when configured and not yet generated; the page already loads
`buildBlockRetrospective()`'s output, which *is* the extra context (render
it with a pure `renderRetrospective(r)`; do not send the raw object).
The `tm_changes` array is in there; the coach comments on each, in order.

## 4. Prompts

Three task prompts in `src/core/coach/prompts.ts`, each ≤ 20 lines, each
ending with the same rule: "Only state numbers that appear above. If the
data does not support a claim, leave the field empty or null." Test each for
the absence of dates and for the presence of that sentence.

## 5. Tests

- Each schema: a valid fixture parses; a string weight, a fourth
  observation, a 130-char headline each fail.
- Each renderer: deterministic, cites the fixture's weights, notes under the
  labelled heading.
- `generate`: mocked client — returns stored content on the second call
  without calling the API; returns `null` and persists nothing on refusal,
  on `parsed_output: null`, on over-budget, on unconfigured.
- Debrief number grounding: for the fixture session, every kg figure in the
  mocked response that the test itself constructs from the fixture appears
  in the rendered context. (This tests the *harness*, not the model — the
  point is the test exists and the renderer exposes the numbers the prompt
  requires.)
- `finishSession` unaffected when the coach throws; invoked once per session.
- `/today`: button shown/hidden across the three conditions; the card
  renders a stored review.

## Do not

- Do not make any of the three automatic on page load. Reviews are one tap;
  debriefs are scheduled by `finishSession` and only by it.
- Do not `await` the API anywhere a Server Component renders.
- Do not store free text where the schema has a field. Render from JSON.
- Do not add a second copy of "last time" — `exerciseContext()` is it.

## Acceptance

- [ ] Finishing a session on a phone shows a debrief within ~15 s (with a key), or the mocked-flow tests are the evidence and `PROGRESS.md` says so.
- [ ] `finishSession` is provably unaffected by the coach failing.
- [ ] One debrief per session, one review per week, one per block — by index, tested.
- [ ] Weekly and block reviews are on-demand buttons with the three-condition gating.
- [ ] Every stored row carries usage and cost; caps respected silently.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.

**Commit:** `feat: chunk 27 — session debriefs, weekly and block reviews`
