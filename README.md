# Training4me

A personal training app. You say how many days a week you can train; it builds a
full block — every week, every session, every set — then walks you through each
session and logs it.

**The philosophy**, in one sentence: a heavy barbell base done submaximally and
repeatably (Magnus Samuelsson), wrapped in primers, tempo, unilateral work and
aerobic capacity so you stay mobile and uninjured while getting genuinely strong
(Marcus Filly's *look good, move well*).

## Setup

You need two values from Supabase before the app can talk to the database.

1. `cp .env.example .env.local`
2. Open the Supabase dashboard for the **sauna-booking** project →
   *Project Settings → API → service_role secret*, and paste it into
   `SUPABASE_SERVICE_ROLE_KEY`.
3. Pick any `APP_PIN`. It locks the app to you and is remembered for 90 days.
4. `pnpm install && pnpm dev` → http://localhost:3000

The training tables live in that project prefixed `t4m_`, completely separate
from the sauna app. They have row-level security on with **no policies at all**,
so the public API key can read and write nothing; every query goes through the
Next.js server with the service role. That is verified in the database itself —
the `anon` role sees zero rows and its inserts fail.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run locally |
| `pnpm test` | 205 unit tests, including the 150-combination generator matrix |
| `pnpm lint` | ESLint, including the rule that keeps `src/core` pure |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | Production build |

## How the program is generated

Everything that decides what you actually do is a pure function in `src/core`,
with no database, no React and no randomness that isn't seeded. A lint rule
enforces it, which is why the whole thing is testable in about four seconds.

1. **Split** — `daysPerWeek` picks a weekly skeleton (2 days = two full-body
   sessions; 4 = upper/lower; 6 adds an aerobic day and a light balance day).
   The same heavy pattern never lands twice inside 48 hours.
2. **Session assembly** — every session is blocks A–F: primer, main lift,
   tempo secondary, accessory superset, finisher, down-regulate. Exactly one
   heavy compound per day, and it gets the biggest slice of the time budget.
3. **Balance constraints** — ten weekly rules are checked and repaired, not
   suggested: pull ≥ push (and ≤ 1.45×), hinge ≈ squat, unilateral work on both
   halves of the body, a loaded carry every week, a vertical push and a vertical
   pull, and weekly volume inside a band for your training frequency.
4. **Time budget** — every set is costed from its tempo (`30X1` = 5 s per rep)
   plus its rest. If a session runs long it trims accessories, then secondary
   sets, then the finisher — **never the main lift**. If the main lift alone
   cannot fit, it says so rather than shipping a session that breaks the promise.
5. **The block** — week one decides the movements; later weeks re-materialise
   from it so only the wave changes. Week 3 of 4 is the peak (5×3 @ 82% plus a
   top single at 87%), week 4 is a deload that deliberately comes in short.

`src/core/generator/matrix.test.ts` runs all 150 combinations of days ×
experience × equipment × block length and asserts every constraint holds and
every session fits. It is the reason to trust the thing.

## How it adapts

- **Before a session** — three sliders (sleep, body, head). Low readiness drops
  the main lift's load and trims volume; it never changes the movements.
- **During** — an RPE of 9.5 on a main set backs the next one off 5%; twice and
  the rest of the lift drops 10%.
- **After a block** — your top sets on the peak week decide each training max:
  full jump if it moved at RPE ≤ 8, a small one at 8.5–9, hold at 9.5+, and −5%
  if you missed reps. Two stalled blocks force a longer wave.
- **Over time** — after five finished sessions the app measures how long you
  actually take versus the estimate and shortens future sessions to match.

## Offline

The session player is local-first. Sets are written to an IndexedDB queue and
flushed opportunistically; the server upsert is keyed on
`(session, block, slot, set)`, so replaying the queue after a dead spot in the
gym can never duplicate a set. A chip shows how many are still queued.

## Layout

```
src/core/        pure training logic — library, generator, time budget, progression
src/server/      Supabase access and server actions (server-only)
src/components/  UI, including the session player
src/app/         routes: /onboarding /plan /session/[id] /history /settings
docs/            the original build plan and the methodology spec
```

`docs/01-METHODOLOGY.md` is the written spec the code implements. Where the code
and that document have diverged, `docs/DECISIONS.md` records why.
