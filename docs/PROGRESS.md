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
