# Training4me

**Live: https://training4me.vercel.app**

A personal training app. You say how many days a week you can train; it builds a
full block — every week, every session, every set — then walks you through each
session and logs it.

**The philosophy**, in one sentence: a heavy barbell base done submaximally and
repeatably (Magnus Samuelsson), wrapped in primers, tempo, unilateral work and
aerobic capacity so you stay mobile and uninjured while getting genuinely strong
(Marcus Filly's *look good, move well*).

## Setup

The app connects to Supabase with the project's **publishable key**, the same
public key every other app on this account uses — the one that is *meant* to
ship in a browser bundle. There is nothing to paste in to run it.

1. `pnpm install && pnpm dev` → http://localhost:3000

Optionally, set `APP_PIN` in `.env.local` to test the lock screen locally; it
does nothing by default outside production (see below).

The training tables live in the **cyberpunk-vibe01** Supabase project, prefixed
`t4m_` and separate from that project's other tables. RLS is enabled with
policies scoped to exactly those tables — nothing else in that project is
reachable through this app, and this app touches nothing else in it either.

**The trade-off, stated plainly:** because the publishable key is public by
design, the `t4m_` tables are reachable by anyone who has it — which is the
same key already visible in every Supabase app's browser network tab, this
account's included. What actually keeps a stranger out is the app's own PIN
gate (below), not the database. For a personal training log that is a
reasonable line to draw. If you want the database itself locked down too, see
*Tightening it* below — it is one environment variable, no code change.

## Deploying to Vercel

The app deploys as-is with **zero required environment variables** — Next.js
is auto-detected and there is nothing to configure for it to run.

1. **Import the repo** — https://vercel.com/new → import
   `Superdupermega/Training4me`. If it is not listed, click *Adjust GitHub App
   Permissions* and grant access to this repository.
2. Deploy. That's the whole setup.

Every push to the repo's default branch deploys automatically after that.

### Turn on the lock

Without `APP_PIN` set, production refuses to serve the app (`503`) rather than
publishing your training log with no lock at all — that is deliberate, not a
bug. To turn it on:

```bash
npx vercel login
npx vercel link --yes --project training4me
npx vercel env add APP_PIN production   # paste a passphrase when prompted
npx vercel --prod                        # rebuild — env changes need a new build
```

**Make it a passphrase, not four digits.** This is genuinely the only thing
between the internet and your log. The cookie stores a SHA-256 hash rather
than the PIN itself, comparison is constant-time, and wrong guesses are slowed
down — none of which saves a four-digit PIN from being guessed in seconds.
Something like `bench-105-in-may` is just as easy to type on a phone.

> **Env var changes need a redeploy, not just a save.** The lock runs in Edge
> middleware, and Vercel inlines environment variables into that bundle at
> build time. If the site returns `503 APP_PIN is not set` when you know you
> set it: Deployments → the latest one → ⋯ → **Redeploy**.

### Tightening it: lock the database too, not just the front door

Set `SUPABASE_SECRET_KEY` in Vercel to the `sb_secret_...` key from
**cyberpunk-vibe01 → Project Settings → API Keys → Secret keys**, then
redeploy. The app picks up a configured secret key automatically and switches
to it — no code change. This closes the trade-off above: with a secret key
configured, only the server can reach the `t4m_` tables at all, publishable
key or not. This value must never go in the repository, which is public.

**Make `APP_PIN` a passphrase, not four digits.** With Vercel Authentication
turned off, this is the only thing between the internet and your log. The cookie
stores a SHA-256 hash rather than the value itself, comparison is constant-time,
and wrong guesses are slowed down — but none of that saves a four-digit PIN from
being guessed. Something like `bench-105-in-may` is easy to type on a phone and
not worth anyone's time to attack.

On your phone, open the deployed URL and use *Add to Home Screen*; it installs
as a standalone app and the session player keeps working without signal.

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
