# 05 — ROADMAP

> **Historical.** This is the v1 roadmap (chunks 01–13), kept as written.
> Later phases: `06-REDESIGN-PLAN.md` (14–21), `10-FEEL-AND-POLISH.md`
> (22–24), `11-COACH-PLATFORM.md` (25–29, current).

13 chunks. Each is one Sonnet session. Each ends green, committed and pushed.

---

## 1. Chunk list

| # | Chunk | Delivers | Depends on | Size |
|---|---|---|---|---|
| 01 | Scaffold & toolchain | Next 15 + TS + MUI M3 theme + lint/test/CI, app boots | — | M |
| 02 | Database & auth | Supabase schema, RLS, migrations, magic-link auth, typed client | 01 | M |
| 03 | Exercise library | 70+ movements as typed data + query/substitution + seed migration | 01 | M |
| 04 | Core primitives | types, tempo, time-budget engine + tests | 01 | S |
| 05 | Splits & waves | week skeletons, day placement, wave tables, TM maths + tests | 04 | M |
| 06 | **The generator** | session assembly, balance rules, repair, matrix + golden tests | 03,04,05 | **L** |
| 07 | Persistence layer | repositories, transactional program write, server actions | 02,06 | M |
| 08 | Onboarding wizard | 6-step flow → generates and stores a real program | 07 | M |
| 09 | Plan views | `/plan`, week strip, today card, week detail | 07,08 | M |
| 10 | **Session player** | the main screen: logging, rest timer, swap, offline | 07,09 | **L** |
| 11 | Feedback loop | readiness, autoregulation, double progression, TM roll-over, `/history` | 10 | L |
| 12 | Polish & ship | a11y, PWA, error/empty states, Playwright E2E, Vercel deploy | all | M |
| 13 | Backlog (optional) | export, notifications, deload override, alternate templates | 12 | S |

`S ≈ 3–6 files · M ≈ 6–14 files · L ≈ 12–25 files.`

## 2. Dependency graph

```
01 ──┬── 02 ──┐
     ├── 03 ──┤
     └── 04 ──┴── 05 ── 06 ── 07 ── 08 ── 09 ── 10 ── 11 ── 12 ── 13
```

Chunks **02, 03, 04** are independent of each other and can be run in any order
(or in parallel sessions on separate branches if you like pain). Everything
from 06 onward is strictly sequential.

## 3. Token budget — how to make this fit a subscription

The cost driver in agentic coding is **context re-read**, not code written. The
plan is built so each session reads only what it needs.

| Chunk | Docs to read | Rough context load | Expected session |
|---|---|---|---|
| 01 | `00` + chunk file | ~8 k | short |
| 02 | `00`, `02-DATA-MODEL` | ~14 k | medium |
| 03 | `00`, `01 §4`, `02 §exercises` | ~14 k | medium |
| 04 | `00`, `01 §6` | ~12 k | short |
| 05 | `00`, `01 §2 §5` | ~14 k | medium |
| 06 | `00`, `01 §3 §4 §5.1 §6 §8` | ~22 k | **long** |
| 07 | `00`, `02`, `03` | ~18 k | medium |
| 08 | `00`, `04 §5.1` | ~14 k | medium |
| 09 | `00`, `04 §5.2` | ~12 k | medium |
| 10 | `00`, `04 §5.3`, `03 §6 §7` | ~20 k | **long** |
| 11 | `00`, `01 §5`, `04 §5.4` | ~18 k | long |
| 12 | `00`, `04 §6 §7`, `03 §9` | ~16 k | medium |
| 13 | `00` + chunk file | ~8 k | short |

Rules that keep the cost down:
1. **`/clear` between every chunk.** Never carry chunk 6's context into chunk 7.
2. **Never paste a whole doc into the prompt** — the chunk file says which
   sections to read; the agent reads them with a tool, which is cheaper and
   avoids duplicating them in context.
3. **`docs/PROGRESS.md` is the hand-off**, not the conversation history.
   Keep entries short; it is read at the start of every chunk.
4. **Split chunk 06 and chunk 10 if a session starts to drift.** Both have a
   documented split point in their chunk files.
5. **Run tests/lint yourself before asking the agent to fix** — a failing
   command pasted in is far cheaper than an agent hunting for it.

## 4. Milestones

| After chunk | You can |
|---|---|
| 04 | Compute session durations from a hand-written session |
| 06 | Generate a complete, rule-valid mesocycle in a unit test — **the product exists, headless** |
| 08 | Sign in, answer 6 questions, get a real plan in the database |
| 10 | Train with it |
| 12 | Ship it |

## 5. Quality gates that never move

- No chunk ends red. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- The matrix test (chunk 06) never gets weakened, only extended.
- The 60-minute promise is enforced by a test, not by review.
- No `any`, no `@ts-expect-error` without a comment naming the reason and a TODO.
