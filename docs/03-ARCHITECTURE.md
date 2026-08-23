# 03 — ARCHITECTURE

## 1. The one rule that matters

```
src/core/  →  pure functions, zero I/O, zero React, zero Supabase
src/server/ →  everything that touches the database or auth ("server-only")
src/app|components/ → everything the user sees
```

`src/core` may import: `zod`, `date-fns`, and other files in `src/core`.
**Nothing else.** An ESLint `no-restricted-imports` rule enforces it, and
`pnpm lint` fails on violation.

Why: the program-generation logic is the whole product. Keeping it pure means
every rule in `01-METHODOLOGY.md` can be tested in milliseconds with no
database, and a chunk can be verified in isolation.

Determinism: any function needing time or randomness takes it as a parameter
(`now: Date`, `rng: () => number`). The generator receives a **seeded** RNG so
the same input always yields the same program (`02-DATA-MODEL.md §programs`).

---

## 2. Data flow

```
Onboarding form
   → zod parse → server action → profiles + training_maxes rows
   → buildGeneratorInput(profile, TMs)          [server]
   → generateProgram(input, rng)                [core, pure]
   → validateProgram(program)                   [core, pure]  ← throws on rule breach
   → persistProgram(program)                    [server, one transaction]
   → redirect /plan

Session player
   → readiness sliders → applyReadiness(session, readiness)   [core, pure]
   → athlete logs sets → optimistic local state + IndexedDB queue
   → flush → server action upsert logged_sets (idempotent on prescribed_set_id)
   → on session complete → computePRs + updatePaceFactor      [core+server]

End of mesocycle
   → evaluateMesocycle(loggedSets, program)      [core, pure]
   → new training_maxes rows (§5.2)
   → generate next program
```

---

## 3. `src/core` module map

| Module | Exports | Chunk |
|---|---|---|
| `types.ts` | all domain types + zod schemas | 4 |
| `tempo.ts` | `parseTempo`, `secondsPerRep` | 4 |
| `timeBudget.ts` | `estimateSet/Exercise/Block/Session`, `fitToBudget` | 4 |
| `library/exercises.ts` | `EXERCISES` const array | 3 |
| `library/query.ts` | `findByPattern`, `isAvailable`, `substitute` | 3 |
| `generator/split.ts` | `buildWeekSkeleton(daysPerWeek)` | 5 |
| `generator/selectExercises.ts` | `pickForSlot` | 6 |
| `generator/assembleSession.ts` | `assembleSession(archetype, ctx)` | 6 |
| `generator/balance.ts` | `validateWeek`, `repairWeek` | 6 |
| `generator/generateProgram.ts` | `generateProgram(input, rng)` | 6 |
| `progression/waves.ts` | `WAVE_4`, `WAVE_6`, `prescriptionFor(week, tm)` | 5 |
| `progression/trainingMax.ts` | `epley`, `nextTrainingMax` | 5 |
| `progression/doubleProgression.ts` | `nextLoad` | 11 |
| `progression/readiness.ts` | `applyReadiness` | 11 |

---

## 4. `src/server`

```
server/
  supabase/server.ts     # createServerClient (cookies), 'server-only' import
  supabase/admin.ts      # service-role client — migrations/seed ONLY, never in a request
  auth.ts                # requireUser(): User | redirect
  repositories/
    profileRepo.ts  programRepo.ts  sessionRepo.ts  logRepo.ts  exerciseRepo.ts
  actions/
    onboarding.ts  program.ts  session.ts  logging.ts  settings.ts
```

Rules:
- Every file in `src/server` starts with `import 'server-only'`.
- Every server action: `requireUser()` → zod parse → repository → `revalidatePath`.
- Repositories return **domain types**, not Supabase rows. Mapping happens here.
- Actions return `{ ok: true, data } | { ok: false, error }`. Never throw across the boundary.
- One Supabase RPC (`persist_program`) does the program write in a single
  transaction; partial programs must never exist.

---

## 5. Routing

| Route | Rendering | Notes |
|---|---|---|
| `/` | Server | redirect → `/plan`, `/onboarding`, or `/sign-in` |
| `/sign-in` | Client | magic link form |
| `/auth/callback` | Route handler | exchanges code, sets cookies |
| `/onboarding` | Client wizard | 6 steps, state in URL search params |
| `/plan` | Server | mesocycle overview, current week highlighted |
| `/plan/week/[n]` | Server | week detail |
| `/session/[id]` | Server shell + client player | the main screen |
| `/history` | Server | logs, PRs, simple trend chart |
| `/settings` | Server + client form | days/week, equipment, cap, regenerate |

Middleware refreshes the Supabase session and guards `(app)` routes.

---

## 6. Client state

No state library. Rules:
- Server data comes from server components as props.
- The session player is the one big client component: `useReducer` over a
  `PlayerState`, persisted to IndexedDB on every action.
- Optimistic UI everywhere the athlete taps mid-set; the network is not on the
  critical path of logging a set.
- The rest timer uses an absolute end timestamp (not `setInterval` counting)
  so backgrounding the phone doesn't break it.

---

## 7. Offline

The session player must work with the network off:
1. On session open, the full session is cached in IndexedDB.
2. Logged sets are appended to an outbox with a client-generated id.
3. A flush loop retries on `online` and on interval, upserting on
   `prescribed_set_id` (unique) so replays are idempotent.
4. The UI shows a small "N sets queued" chip when the outbox isn't empty.

## 8. Testing strategy

| Level | Tool | What |
|---|---|---|
| Unit | Vitest | tempo, time budget, waves, TM maths, substitution |
| Property | Vitest + `fast-check` | **the matrix test**: for every `daysPerWeek × experience × equipment × weeks`, a generated program satisfies every §4.4 constraint and every session is under cap |
| Golden | Vitest snapshot | the §8 worked example regenerates identically |
| Integration | Vitest | repositories against a local Supabase (skipped in CI if unavailable) |
| E2E | Playwright | sign-in → onboarding → plan → log a session → history |

The matrix test is the project's spine. It must exist by end of chunk 6 and
must never be weakened.

## 9. Performance & quality budget

- Plan page LCP < 2.0 s on a mid-range phone, 4G.
- Session player interaction to log a set < 100 ms (local-first).
- `pnpm build` produces zero type errors, zero ESLint warnings.
- Lighthouse a11y ≥ 95 on `/plan` and `/session/[id]`.
