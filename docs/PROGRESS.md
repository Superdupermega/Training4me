# PROGRESS

The hand-off log between chunks. Read at the start of every session, appended at
the end of every session. Keep entries short — this file must stay cheap to read.

Format:

```
## Chunk NN — <name> — YYYY-MM-DD
**Landed:** what now exists.
**Deviated:** anything that differs from the plan, and why.
**Next chunk must know:** gotchas, decisions, names to reuse.
**Blocked:** anything unfinished (empty if none).
```

---

## Chunk 00 — Plan — 2026-08-23
**Landed:** The full build plan: context, methodology spec, data model,
architecture, design system, roadmap, runbook and 13 chunk prompts.
**Deviated:** —
**Next chunk must know:** The repo is otherwise empty; chunk 01 initialises the
Next.js app at the repo root and must not clobber `docs/`.
**Blocked:** Supabase project must be created by the user before chunk 02.

## Built in full — 2026-08-24
**Landed:** The whole app, not just the plan. Chunks 01-11 of the roadmap are
done in one pass: scaffold, training engine, database, server layer, onboarding,
plan views, session player, history and settings.

**Deviated:** Several, all recorded in `DECISIONS.md`. The largest: single
athlete so there is no auth (PIN gate + service-role access behind RLS with no
policies); later weeks re-materialise from week one rather than being generated
independently; balance ratios are validated on the template week and invariants
on the rest; the exercise library lives in TypeScript rather than being seeded
into Postgres, since only this app reads it.

**Verified:** 206 tests green, including the 150-combination matrix. Schema
round-trips real generated sessions. Replaying an offline log queue twice leaves
one row per set. The `anon` role sees zero rows and cannot insert. Lint,
typecheck and build all clean. Dev server boots and the PIN gate redirects.

**Not verified:** the live runtime against Supabase, because the service-role
key is not available in this environment. First run after adding it to
`.env.local` will exercise it.

**Blocked:** Vercel project creation returns 403 from this session's Vercel
connection, so the project has to be imported once by hand — steps are in the
README. After that, pushes deploy automatically.

## Chunk 14–21 — Redesign plan — 2026-08-25
**Landed:** `docs/06-REDESIGN-PLAN.md` plus eight chunk files (14–21) covering
performance, a five-destination Material 3 shell, the muscle taxonomy and
library expansion, the exercise browser, the program builder, exercise context
("last time / expected"), the analysis view, and close-out polish. No code
changed.

**Diagnosed:** the "unresponsive menus" complaint is four compounding causes —
`router.push` in the bottom nav (no prefetch, no optimistic highlight), no
`loading.tsx` anywhere against `force-dynamic` routes, serial Supabase queries,
and Vercel functions in `iad1` against a Supabase project in `eu-north-1`.
Full write-up in `06-REDESIGN-PLAN.md` §2; fixes in chunk 14.

**Next chunk must know:**
- `t4m_session.blocks` (JSONB) is the runtime contract. The builder is a second
  producer of that shape, not a second player.
- Growing the exercise library would silently reshape every generated program.
  Chunk 16 adds `inGeneratorPool` and a tripwire test pinning the pool at 93.
- `docs/02-DATA-MODEL.md` describes a schema that was never built. The live
  schema is dumped in `06-REDESIGN-PLAN.md` §7; chunk 21 rewrites the doc.
- Six known defects are listed in `chunk-21-polish.md` §1.

**Blocked:** nothing. Run chunk 14 first.
