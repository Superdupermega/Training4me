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

One user = one athlete, permanently. No accounts, no teams, no social, no
video. There is no Supabase auth: the app's front door is a PIN gate
(`src/middleware.ts` for navigation, `requireUnlocked()` for every mutation)
and the database itself refuses anything but the server's secret key.

**Phases so far** — each has a plan doc and executable chunk files:

| Phase | Chunks | Plan | State |
|---|---|---|---|
| v1 — generator that logs | 01–13 | `05-ROADMAP.md` | done |
| v2 — a training app you own | 14–21 | `06-REDESIGN-PLAN.md` | done |
| v2.5 — feel and polish | 22–24 | `10-FEEL-AND-POLISH.md` | done |
| v3 — the coach platform | 25–29 | `11-COACH-PLATFORM.md` | **current** |

`docs/PROGRESS.md` says exactly where the current phase stands.

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
| UI | **MUI v9** (`@mui/material` ^9) themed to Material Design 3 tokens in `src/theme/theme.ts`, light and dark via `cssVariables` |
| DB | **Supabase Postgres** through `@supabase/supabase-js`, **server-only** (`src/server/db.ts`), with `SUPABASE_SECRET_KEY`. RLS: every `t4m_` table has one `service_role`-only policy. No Supabase auth. |
| Front door | **PIN gate**: `src/middleware.ts` (Edge, `APP_PIN`) + `requireUnlocked()` as the first statement of every mutating action and route handler |
| Validation | **Zod 4** — every boundary (form, action, route body) |
| Mutations | **Server Actions** in `src/server/actions.ts` and `src/server/routines.ts`; Route Handlers only for export, cron, client-error logging and the coach stream (v3) |
| Tests | **Vitest** + Testing Library (jsdom). No Playwright. |
| Deploy | **Vercel**, region `arn1` next to the Supabase project (`eu-north-1`); CI gate in `.github/workflows/ci.yml` |
| Dates | `date-fns` (no moment, no dayjs); all "today" maths in the profile's timezone via `src/core/dates.ts` |
| Offline queue | `idb-keyval` (`src/components/session/outbox.ts`) |
| Push | `web-push`, hand-rolled service worker in `public/sw.js` |
| Coach (v3) | `@anthropic-ai/sdk`, **server-only** under `src/server/coach/`, model `claude-opus-5` — see `11-COACH-PLATFORM.md` §3.4 |

Not allowed without an explicit decision recorded in `docs/DECISIONS.md`:
a state library (Redux/Zustand/Jotai), an ORM (Prisma/Drizzle), a CSS framework
(Tailwind), a component kit other than MUI, a charting library (every chart is
hand-rolled SVG), a markdown renderer, a second LLM provider, or any LLM call
outside `src/server/coach/`.

---

## 4. Repository layout

```
src/
  app/                      # Next.js App Router
    today/ program/ exercises/ history/ profile/   # the five nav destinations
    program/builder/[id]  program/complete          # builder, block retrospective
    session/[id]/         # the session player (full-screen, not a destination)
    coach/                # the coach (full-screen, v3)
    onboarding/ unlock/ offline/
    api/export/{json,csv}  api/cron/reminders  api/log-client-error  api/coach (v3)
  core/                     # ← PURE TypeScript. No React. No Supabase. No SDKs. No I/O.
    types.ts dates.ts tempo.ts timeBudget.ts plates.ts push.ts
    library/                # ~300 exercises (exercises/*.ts), muscles.ts, query.ts, equipment.ts
    generator/              # split, assembleSession, balance, materialize, generateProgram, matrix.test
    progression/            # waves, trainingMax, readiness, prs, retrospective, blockControls (v3)
    builder/                # routine types, materializeRoutine, reconcileProgram, targeting, advise
    coach/                  # dossier, prompts, schemas, proposals (v3)
  server/                   # server-only: db, repo, analytics, actions, routines, lock, push, coach/ (v3)
  components/               # UI: nav shell, session player, builder, exercises, profile, charts, today
  theme/                    # M3 tokens + MUI theme + Providers
public/sw.js                # service worker
scripts/                    # check-action-isolation.mjs (pnpm verify:actions)
docs/                       # plans, specs, chunk briefs, PROGRESS, DECISIONS
```

There is no `supabase/migrations/` directory: the schema is described in
`docs/02-DATA-MODEL.md` and migrations are applied to the live project
through whatever Supabase tooling the session has, then verified and
recorded there (chunk 23 set the pattern).

**The `src/core` rule is the most important architectural rule in this project.**
Everything that decides *what the athlete does* is a pure function of its inputs.
No `fetch`, no `Date.now()` (pass a clock), no randomness (pass a seeded RNG),
no Supabase, no React, no Anthropic SDK. `eslint.config.mjs` enforces the import
half; the rest is convention. This is what makes the program logic testable and
what lets a chunk be verified without a database — and, in v3, what keeps the
coach from ever being the thing that decides.

---

## 5. Conventions

- **Files**: components `PascalCase.tsx`, everything else `camelCase.ts`.
- **Exports**: named exports only, except Next.js pages/layouts (default required).
- **Types**: no `any`. `unknown` + a Zod parse at boundaries. `satisfies` over casts.
- **Units**: store **kilograms** and **seconds** in the DB, always. Convert at the
  view layer only.
- **IDs**: `uuid` from Postgres `gen_random_uuid()`. Exercise IDs are stable
  human-readable slugs (`back-squat`), never renamed once shipped.
- **Enums**: `text` + `check` in Postgres, mirrored by a `const` array + type in
  `core/types.ts`. One source of truth per enum.
- **Errors**: server actions return `{ ok: true, data } | { ok: false, error: string }`.
  Never throw across the server/client boundary.
- **Every mutating action** starts with `await requireUnlocked()`. `/unlock`
  never imports a shared action module (`pnpm verify:actions`).
- **Theme**: `t.vars.palette.x.main` inside style callbacks, never
  `theme.palette.x.main` (bakes one scheme's hex — the most repeated bug here).
- **Bundles**: per-route first-load JS budgets in `chunk-21-polish.md` §4.
  A blown budget is reported in `PROGRESS.md`, never edited.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
  One commit per chunk minimum.
- **Branch**: the branch named in your prompt. Chunks 01–24 landed on `main`.

## 6. Definition of done for any chunk

A chunk is done when **all** of these pass — no exceptions, no "will fix next chunk":

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm verify:actions
```

plus the chunk's own acceptance criteria, plus a commit pushed to the branch,
plus `docs/PROGRESS.md` updated with an entry in its format: what landed, what
deviated (and a matching `docs/DECISIONS.md` row), what the next chunk must
know, what is blocked.

If you cannot make something pass, **stop and write the blocker into
`docs/PROGRESS.md`** rather than weakening a test, deleting an assertion, or
`// @ts-expect-error`-ing past it.
