# Training4me

**Live: https://training4me.vercel.app**

A personal training app, StrengthLog-flavoured. You say how many days a week
you can train and it builds a full block — every week, every session, every
set — then walks you through each session and logs it. Or skip the generator
entirely and build your own program, day by day, exercise by exercise, from
a library of ~300 movements across every muscle group (Marcus Filly's
functional-bodybuilding style tagged and browsable on its own). Either way
it plays in the same session player, logs to the same history, and shows up
on the same analysis page.

**The philosophy**, in one sentence: a heavy barbell base done submaximally and
repeatably (Magnus Samuelsson), wrapped in primers, tempo, unilateral work and
aerobic capacity so you stay mobile and uninjured while getting genuinely strong
(Marcus Filly's *look good, move well*).

## Setup

The app connects to Supabase, but not with the publishable key alone anymore
— see *Database access* below before you assume `pnpm dev` shows real data.

1. `pnpm install`
2. Set `SUPABASE_SECRET_KEY` in `.env.local` — see *Database access* for
   where to get it. Without it the dev server still boots, but every
   `t4m_` read and write comes back empty or fails outright.
3. `pnpm dev` → http://localhost:3000

Optionally, set `APP_PIN` in `.env.local` to test the lock screen locally; it
does nothing by default outside production (see below).

The training tables live in the **cyberpunk-vibe01** Supabase project, prefixed
`t4m_` and separate from that project's other tables — nothing else in that
project is reachable through this app, and this app touches nothing else in
it either.

### Database access

`pg_policies` on the live project shows all 14 `t4m_` tables carrying exactly
one `service_role`-only policy each, with no `anon`/`authenticated` grant
anywhere — confirmed directly against the project, not assumed. That has
been true since 2026-08-26 (`docs/08-RLS-TIGHTENING.md`); this README
described an earlier, more open state (`USING (true)` for `anon` and
`authenticated`) as an open trade-off for longer than it should have. There
is no trade-off left to state: the publishable key cannot read or write a
`t4m_` row at all, in any environment. Only
`SUPABASE_SECRET_KEY` — set in Vercel for production (already configured
there), and in `.env.local` for local dev — reaches the database, exactly
the way `src/server/db.ts` is written: it defaults to the publishable key
only because that used to be enough, and now it is enough for nothing.
Get the secret key from **cyberpunk-vibe01 → Project Settings → API Keys
→ Secret keys**; it must never go in the repository, which is public.

The app's own PIN gate (below) is still the thing a human hits first, but
it is no longer the only thing standing between a stranger and the data —
the database refuses the publishable key regardless of whether the PIN
gate is even reached.

## Deploying to Vercel

The app deploys as-is with **zero required environment variables** — Next.js
is auto-detected and there is nothing to configure for it to run.

1. **Import the repo** — https://vercel.com/new → import
   `Superdupermega/Training4me`. If it is not listed, click *Adjust GitHub App
   Permissions* and grant access to this repository.
2. Deploy. That's the whole setup.

Every push to the repo's default branch deploys automatically after that.
`vercel.json` pins the deployment to the **`arn1`** (Stockholm) region —
next to the Supabase project itself (`eu-north-1`) — so every server-rendered
page and server action makes one short hop to the database instead of a
transatlantic one. This is a large share of why the app feels responsive at
all; moving the Supabase project or Vercel's regions out of sync with each
other would quietly undo it.

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

**Make it a passphrase, not four digits.** This is the thing standing between
the internet and the *app* — the database behind it refuses an unauthenticated
request on its own now (see *Database access* above), but the PIN is still
what a human actually hits first. The cookie stores a SHA-256 hash rather
than the PIN itself, comparison is constant-time, and wrong guesses from one
IP are rate-limited server-side (8 per 15 minutes, enforced in Postgres —
not just a client-visible delay) — none of which saves a four-digit PIN from
being guessed within that budget. Something like `bench-105-in-may` is just
as easy to type on a phone.

> **Env var changes need a redeploy, not just a save.** The lock runs in Edge
> middleware, and Vercel inlines environment variables into that bundle at
> build time. If the site returns `503 APP_PIN is not set` when you know you
> set it: Deployments → the latest one → ⋯ → **Redeploy**.

### The database itself: already locked, not just the front door

`SUPABASE_SECRET_KEY` is already set in Vercel — see *Database access*
above for why it has to be, not just why it might be worth doing. If you
are standing up a fresh deployment of this repo rather than continuing the
existing one: set `SUPABASE_SECRET_KEY` to the `sb_secret_...` key from
**cyberpunk-vibe01 → Project Settings → API Keys → Secret keys**, then
redeploy — the app picks up a configured secret key automatically and
switches to it, no code change. Skip this and the deployment boots but
every `t4m_` read and write fails, publishable key or not. This value must
never go in the repository, which is public.

**Make `APP_PIN` a passphrase, not four digits.** With Vercel Authentication
turned off, this is what a human actually hits first — the database itself
refuses an unauthenticated request regardless (above), but the PIN is still
the app's own front door. The cookie stores a SHA-256 hash rather than the
value itself, comparison is constant-time, and wrong guesses from one IP are
rate-limited server-side — but none of that saves a four-digit PIN from being
guessed inside that budget. Something like `bench-105-in-may` is easy to type
on a phone and not worth anyone's time to attack.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run locally |
| `pnpm test` | 324 unit tests, including the 150-combination generator matrix |
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

## Building it yourself

`/program/builder` is the other way to get a program — no generator, no
balance rules, just you choosing exercises for each day. Pick from the same
~300-exercise library `/exercises` browses (filterable by muscle group and
by style, including a Marcus Filly / functional-bodybuilding tag), set the
sets/reps/tempo/rest and how the weight is decided (a fixed weight, an RPE,
a %-of-training-max, or bodyweight/duration/distance for the rest), and
arrange it into supersets if you want. Every time you pick an exercise —
here or in the generated plan — you see either what you actually did last
time for that exact exercise, or, if you never have, what's expected of it
given your training max in the underlying lift (`ExerciseContextPanel`,
`src/server/exerciseContext.ts`). **Schedule this program** turns the
routine into real dated sessions that play in the exact same session
player as a generated block — nothing downstream of that point can tell the
two apart. A generated program can also be duplicated back into an editable
routine if you want to start from it rather than a blank week.

**You can keep editing it while you are training it.** Open the live program
from */program* → *Edit this program*, change whatever you want, and *Save &
update what I am training* re-materialises it over the block already in
flight: every session you have not started yet is rewritten, on the dates it
was already scheduled for, and every session you have finished, are part-way
through, or skipped keeps exactly what you did. The block keeps its start
date and its history. Restarting from week 1 today is still there, behind a
confirmation, for when that is genuinely what you want.

A **generated** block has no routine behind it, so editing that one live is
two steps: duplicate it into a routine (*/program* → *Duplicate as routine*),
edit it, then *Apply this to the block I am training instead*. Same deal —
your dates and everything trained survive — with one honest catch the
confirmation spells out: from that point the block is the routine's, so the
generator's wave over the weeks ahead, the peak week and the deload, goes
with it.

## During a session

The weight on every set is **typed in, not assumed**. The plan's prescription
and what you lifted last time are both shown — as the field's placeholder, as
a one-tap *Use 100 kg*, and as the number the +/− steppers land on from empty
— but nothing enters them for you, and the one-tap ✓ on a movement you have
not chosen a load for opens the set and asks instead of logging a number
nobody typed. A logged set is a record of what happened, and the plan does not
know that.

You only pay that once per movement: **the weight you pick on the first set
carries over to the rest of them**, so the sets after it are back to a single
tap. Leaving the field empty is itself an answer — "bodyweight, no load" — and
carries over the same way. If a set goes to RPE 9.5 the backoff takes the
carried weight down with the prescription, so the next tap cannot quietly put
the full load back on the bar.

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

Separately, a small hand-rolled service worker (`public/sw.js`, no library)
covers the case above that: not "a set won't send," but "the app itself
can't load right now." It precaches the static shell and swaps in a
branded `/offline` screen instead of the browser's own error page when a
page navigation can't reach the network — it does not cache dynamic pages,
on purpose, since a stale cached session or history page would be actively
misleading.

On your phone, open the deployed URL and use *Add to Home Screen*; it
installs as a standalone app (`src/app/manifest.ts`) and the session player
keeps logging sets without signal, per the outbox above.

## Layout

```
src/core/        pure training logic — library, generator, time budget, progression, builder
src/server/      Supabase access and server actions (server-only)
src/components/  UI, including the session player, the nav shell, and the routine builder
src/app/         routes: /onboarding /today /program /program/builder /exercises
                  /history /profile /profile/settings /profile/export /session/[id]
docs/            the original build plan, the methodology spec, the redesign plan (06),
                  the production review (07) with its RLS-tightening (08) and
                  push-notification (09) follow-ups, the feel-and-polish plan (10),
                  and the coach-platform plan (11) with its chunk briefs 25–29
```

`docs/01-METHODOLOGY.md` is the written spec the code implements. Where the code
and that document have diverged, `docs/DECISIONS.md` records why.
