# RUNBOOK — how to actually build this

## The loop

For each chunk `NN`, in a **fresh** agent session:

```
/clear
```

then paste exactly this, with `NN` and `<branch>` replaced:

```
Read docs/00-CONTEXT.md, docs/PROGRESS.md, and docs/chunks/chunk-NN-*.md,
plus every doc the chunk file's "Read first" line names.
Then execute that chunk file completely.
Do not start any work belonging to a later chunk.
When done: run pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm verify:actions,
append your entry to docs/PROGRESS.md, record any deviation in docs/DECISIONS.md,
commit with the message at the end of the chunk file, and push to <branch>.
```

That's the whole ritual. The chunk file carries everything else.

**Current phase:** v3, chunks 25–29, plan in `docs/11-COACH-PLATFORM.md`.
Order: 25 and 26 in either order → 27 → 28. Chunk 29 is independent; run it
whenever a session has room, and before 28 if chunk 25 reports `/coach` over
budget.

## Before you start

Node 20+ and `pnpm` (`corepack enable`). Then `.env.local` (never committed —
`.gitignore` covers `.env*`; the repository is public):

```
SUPABASE_SECRET_KEY=     # required for any real data — README "Database access"
APP_PIN=                 # optional locally; production refuses to boot without it
ANTHROPIC_API_KEY=       # v3 only; without it every coach surface is absent by design
COACH_DAILY_CAP_USD=2    # optional, these are the defaults
COACH_MONTHLY_CAP_USD=20
```

Production values live in Vercel's project settings, and an env change needs
a redeploy (README, "Turn on the lock").

## When a chunk goes wrong

- **The agent drifts into a later chunk** → stop it, `/clear`, restart the chunk.
- **A test won't pass** → the agent must write the blocker into `docs/PROGRESS.md`,
  not delete the test. A deleted or `.skip`ped test in the diff means reject and re-run.
- **A migration cannot be applied** → the SQL goes into `PROGRESS.md` under
  *Blocked*; the code ships gated so nothing renders half-built (chunk 25 §6).
  Apply it by hand, then re-run the chunk's verification step.
- **The session gets long** → the chunk files with independent items (24, 29)
  say so; commit what is green, `/clear`, continue.
- **A rule turns out to be wrong in practice** → change the plan doc *first*,
  note it in `docs/DECISIONS.md`, then change the code.

## What you review as the human

You don't need to read all the code. Per chunk:

1. `pnpm test` output — were tests added, and do they assert real behaviour?
2. The diff of `docs/PROGRESS.md` — does the deviation list surprise you?
3. The route table in `PROGRESS.md` when a chunk touches a client bundle.

And the checks only a person with a phone can do — no agent can, and every
one of them is recorded as *unverified* until you do:

4. **Rest-timer notification while backgrounded** (`DECISIONS.md`
   2026-08-30): start a 90 s rest, switch apps, see whether anything fires.
   Write what happened into that `DECISIONS.md` row.
5. **A real session debrief** (chunk 27): finish a session on the phone,
   watch for the debrief card within ~15 s, and read it against what you
   actually did — every number it states must be one you logged.
6. **A coach proposal end to end** (chunk 28): ask for a swap, apply it,
   confirm `/program` shows it and the next session plays it.
7. **A test week** (chunk 26): the one time it is worth doing the whole
   thing for real — deload, test, and check the training max that comes out.

## After the phase

Train a block with the coach on. Keep the list of everything it said that was
wrong, unhelpful or late. That list — not more features — is the next plan.
