# 00 — CONTEXT (read this first, every session)

This file is the shared brain. Every chunk prompt begins by telling you to read
it. Keep it under ~500 lines forever; if something grows, it belongs in one of
the numbered spec docs instead.

---

## 1. What we are building

**Training4me** — a personal strength-training app. The user says how many days
a week they can train; the app generates a full training period (a mesocycle of
4 or 6 weeks), day by day, set by set, then guides them through each session and
logs it.

One user = one athlete. This is not a coaching platform. No teams, no social, no
chat, no video. Multi-user only in the sense that auth exists and rows are
isolated.

### The five product constraints — never violate these

1. **60-minute ceiling.** A generated session's estimated duration must be
   ≤ the user's session cap (default 3600s), computed by the time-budget
   engine. If it doesn't fit, the generator trims — it never ships an
   over-budget session.
2. **The main lift is big as hell.** Every session has exactly one T1 heavy
   compound and it gets the largest slice of the time budget (target 35–45%).
   Accessories get cut before the main lift does.
3. **Simple movements only.** Default library excludes snatch, clean & jerk,
   muscle-up, pistol, handstand push-up, kipping anything. A movement's
   `complexity` must be `simple` or `moderate` unless the user has explicitly
   enabled `allowAdvanced`.
4. **Look good, move well.** Every session includes a primer and at least one
   tempo-controlled or unilateral piece. Weekly structural-balance rules are
   hard constraints, not suggestions. Getting strong must not make the user
   stiff.
5. **Material Design 3, plainly.** Standard M3 components, standard elevation,
   standard motion. No bespoke visual invention. Legible at arm's length in a
   gym, one-handed, with sweaty thumbs.

---

## 2. The training philosophy in one page

Two sources, deliberately fused. When they conflict, the resolution rule is in
`01-METHODOLOGY.md §1.3`.

### Magnus Samuelsson layer — the base
- Barbell basics carry the program: squat, deadlift/hinge, press, row, chin.
- Heavy, low-rep, *submaximal*. Leave reps in reserve. Grinding to failure on
  the main lift is a bug.
- Progress measured over months and years, not sessions. Small jumps, held.
- Never train through pain. Being able to train next week beats today's PR.
- Grip, trunk and carries are training, not filler.
- Thorough warm-up. Full ROM. Control the bar down.

### Marcus Filly layer — the quality
- **Persistence primer** opens every session: low-intensity aerobic + activation,
  6–8 min, gets tissue warm and the athlete present.
- **Tempo** on secondary work (e.g. `30X1`) — slow eccentric, controlled, no bouncing.
- **Unilateral** work every week, both upper and lower, for symmetry and hip/shoulder health.
- **Structural balance**: pull ≥ push, hinge ≈ squat, posterior chain respected.
- **Aerobic base** (Zone 2) instead of daily metabolic smashing.
- Supersets (A1/A2) to buy time without rushing the heavy work.

### The fusion in one sentence
*A heavy barbell base done submaximally and repeatably, wrapped in primers,
tempo, unilateral work and aerobic capacity so the athlete stays mobile,
symmetrical and uninjured while getting genuinely strong.*

---

## 3. Stack (fixed — do not substitute)

| Layer | Choice |
|---|---|
| Framework | **Next.js 15**, App Router, React 19, TypeScript `strict` |
| Package manager | **pnpm** |
| UI | **MUI v6** themed to Material Design 3 tokens (`src/theme`) |
| DB / Auth | **Supabase** (Postgres + RLS + magic-link auth), `@supabase/ssr` |
| Validation | **Zod** — every boundary (form, action, API) |
| Mutations | **Server Actions** for app mutations; Route Handlers only for webhooks/cron |
| Unit tests | **Vitest** |
| E2E | **Playwright** |
| Deploy | **Vercel** |
| Dates | `date-fns` (no moment, no dayjs) |
| Offline queue | `idb-keyval` |

Not allowed without an explicit decision recorded in `docs/DECISIONS.md`:
a state library (Redux/Zustand/Jotai), an ORM (Prisma/Drizzle), a CSS framework
(Tailwind), a component kit other than MUI, a charting library beyond one.

---

## 4. Repository layout

```
src/
  app/                      # Next.js App Router
    (auth)/                 # sign-in, callback
    (app)/                  # authenticated shell
      onboarding/           # the wizard
      plan/                 # mesocycle overview + week view
      session/[id]/         # the session player (the main screen)
      history/              # logs, PRs, trends
      settings/
    api/                    # route handlers (rare)
  core/                     # ← PURE TypeScript. No React. No Supabase. No I/O.
    types.ts                # domain types
    tempo.ts                # tempo parsing + per-rep seconds
    timeBudget.ts           # session duration estimation + trimming
    library/                # exercise library + taxonomy + queries
    generator/              # split selection, session assembly, balance rules
    progression/            # training-max waves, double progression, autoreg
  server/                   # server-only: supabase clients, repositories, actions
  components/               # React components (dumb where possible)
  theme/                    # M3 tokens + MUI theme
  lib/                      # small shared helpers
supabase/migrations/        # SQL migrations, numbered
docs/                       # this plan
tests/e2e/                  # Playwright
```

**The `src/core` rule is the most important architectural rule in this project.**
Everything that decides *what the athlete does* is a pure function of its inputs.
No `fetch`, no `Date.now()` (pass a clock), no randomness (pass a seeded RNG),
no Supabase, no React. This is what makes the program logic testable and what
lets a chunk be verified without a database.

---

## 5. Conventions

- **Files**: components `PascalCase.tsx`, everything else `camelCase.ts`.
- **Exports**: named exports only, except Next.js pages/layouts (default required).
- **Types**: no `any`. `unknown` + a Zod parse at boundaries. `satisfies` over casts.
- **Units**: store **kilograms** and **seconds** in the DB, always. Convert at the
  view layer only. Weight column type `numeric(6,2)`.
- **IDs**: `uuid` from Postgres `gen_random_uuid()`. Exercise IDs are stable
  human-readable slugs (`back-squat`), never renamed once shipped.
- **Money/enums**: enums live in Postgres as `text` + `check` constraints, mirrored
  by a Zod enum in `core/types.ts`. One source of truth per enum, cross-checked by a test.
- **Errors**: server actions return `{ ok: true, data } | { ok: false, error: string }`.
  Never throw across the server/client boundary.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
  One commit per chunk minimum; more is fine.
- **Branch**: `claude/training-schedule-app-plan-hq2si9`.

## 6. Definition of done for any chunk

A chunk is done when **all** of these pass — no exceptions, no "will fix next chunk":

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

plus the chunk's own acceptance criteria, plus a commit pushed to the branch,
plus `docs/PROGRESS.md` updated with a 3–8 line entry: what landed, what
deviated from the plan, what the next chunk must know.

If you cannot make something pass, **stop and write the blocker into
`docs/PROGRESS.md`** rather than weakening a test, deleting an assertion, or
`// @ts-expect-error`-ing past it.
