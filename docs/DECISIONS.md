# DECISIONS

Anything that contradicts or extends the specs goes here, with a date and a
reason. If code and docs disagree, this file is where the disagreement gets
resolved — and then the spec gets updated.

| Date | Decision | Why | Docs updated |
|---|---|---|---|
| 2026-08-23 | Next.js + MUI + Supabase, no ORM, no state library | Fewest moving parts for a single-user app; MUI gives Material 3 without hand-rolling components; Supabase gives auth + Postgres + RLS in one. | `00-CONTEXT.md §3` |
| 2026-08-23 | All program logic lives in pure `src/core` | The generator is the product; it must be testable in milliseconds without a database. | `03-ARCHITECTURE.md §1` |
| 2026-08-23 | Balance rules B1–B10 are hard constraints, not heuristics | "Look good, move well" only survives contact with a generator if it is enforced by validation. | `01-METHODOLOGY.md §4.4` |
| 2026-08-23 | Time budget trims accessories, never the main lift | The main part stays big as hell by construction. | `01-METHODOLOGY.md §1.3, §6.3` |
