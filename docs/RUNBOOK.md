# RUNBOOK — how to actually build this

## The loop

For each chunk `NN`, in a **fresh** Claude Code session (Sonnet is fine — the
thinking is already in the docs):

```
/clear
```

then paste exactly this, with `NN` replaced:

```
Read docs/00-CONTEXT.md, docs/PROGRESS.md (if it exists), and docs/chunks/chunk-NN-*.md.
Then execute that chunk file completely.
Do not start any work belonging to a later chunk.
When done: run pnpm lint && pnpm typecheck && pnpm test && pnpm build,
append your entry to docs/PROGRESS.md, commit with the message in the chunk file,
and push to claude/training-schedule-app-plan-hq2si9.
```

That's the whole ritual. The chunk file carries everything else.

## Before you start

1. **Create a Supabase project** (needed from chunk 02). Keep the project URL,
   the publishable/anon key and the service-role key.
2. Copy `.env.example` → `.env.local` after chunk 01 creates it and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=      # server-only, never in NEXT_PUBLIC_*
   ```
3. Node 20+ and `pnpm` (`corepack enable`).

**Never commit `.env.local`.** Chunk 01 adds it to `.gitignore`; verify.

## Order

Follow `docs/05-ROADMAP.md §2`. 02, 03 and 04 can be done in any order. From
06 onward, strictly sequential.

## When a chunk goes wrong

- **The agent drifts into a later chunk** → stop it, `/clear`, restart the chunk.
  The prompt above says "do not start later work" for exactly this reason.
- **A test won't pass** → the agent must write the blocker into `docs/PROGRESS.md`,
  not delete the test. If you see a deleted or `.skip`ped test in the diff,
  reject it and re-run the chunk.
- **The session gets long/expensive** → chunks 06 and 10 have explicit split
  points ("PART A / PART B"). Commit part A, `/clear`, run part B.
- **A rule turns out to be wrong in practice** → change `docs/01-METHODOLOGY.md`
  *first*, note it in `docs/DECISIONS.md`, then change the code. The docs are
  the source of truth; code that disagrees with them is a bug.

## What you review as the human

You don't need to read all the code. Check these four things per chunk:

1. `pnpm test` output — were tests added, and do they assert real behaviour?
2. The diff of `docs/PROGRESS.md` — does the deviation list surprise you?
3. For 06: run the matrix test and read one generated week out loud. Does it
   look like a program you'd actually want to do?
4. For 10: use it on your phone for one real session. That's the only test that
   matters in the end.

## After chunk 12

Run the app for a full mesocycle. Keep a list of everything that annoyed you.
That list, not chunk 13, is your real backlog.
