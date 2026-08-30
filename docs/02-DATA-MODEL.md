# 02 — DATA MODEL

This describes the schema as it is actually deployed, in the `evlxbewvsgrlncvtagmf`
Supabase project (`eu-north-1`), as of chunk 21 (2026-08-25). **§1 below
replaces the multi-user schema this document originally specified** — that
version was never built; it's kept verbatim in the appendix (§6) as a record
of the design that was superseded, not as a description of anything live.

## 0. Why this is a different shape than §6's plan

The app is single-athlete — "one training log, one training partner," per
`docs/06-REDESIGN-PLAN.md` §1 — not a multi-tenant product. Building real
per-user RLS (`auth.uid()` scoping, a `profiles` row per account, foreign
keys to `auth.users`) would have added an entire authentication surface for
an app with exactly one intended user, gated instead by the PIN lock in
`src/middleware.ts`. Every `t4m_*` table therefore carries **one permissive
policy** — `for all to anon, authenticated using (true)` — and no `user_id`
column anywhere. This is a deliberate v1 decision (`DECISIONS.md`), not an
oversight: if this app ever needs a second athlete, it needs real per-user
RLS added at that point, not before.

The other structural difference: exercises are **not a database table**.
`exercises` in the original plan is `src/core/library/exercises/` in
TypeScript (chunk 16) — reference data that ships with the app, not data an
athlete edits, so it has no business living behind a network round trip. The
one exception is `t4m_custom_exercise`, added in chunk 16/18 for exercises
an athlete adds themselves that the static library doesn't have — those
*are* user data and do live in the database.

## 1. Tables (live)

### `t4m_profile`
Single row, `id = 'me'`. Athlete settings — no `user_id`, there is exactly
one profile.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | always `'me'` |
| `display_name` | `text` nullable | |
| `units` | `text` | `metric` \| `imperial` — **display only**, storage is always kg |
| `experience` | `text` | `beginner` \| `intermediate` \| `advanced` |
| `days_per_week` | `int` nullable | check 2..6 |
| `session_cap_sec` | `int` | default 3600, check 1800..5400 |
| `equipment_profile` | `text` | default `full_gym` |
| `equipment` | `text[]` | fine-tune flags on top of the profile |
| `allow_advanced` | `bool` | default false |
| `micro_plates` | `bool` | default false |
| `bodyweight_kg` | `numeric` | default 80 |
| `pace_factor` | `numeric` | default 1.00, check 0.80..1.30 |
| `preferred_weekdays` | `int[]` | 1..7 |
| `mesocycle_weeks` | `int` | 4 or 6 |
| `favourite_exercises` | `text[]` | added chunk 16/17 — starred in the browser |
| `onboarded_at` | `timestamptz` nullable | |
| `created_at` / `updated_at` | `timestamptz` | |

### `t4m_training_max`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `exercise_id` | `text` | library id — no FK, the library isn't a table (§0) |
| `value_kg` | `numeric` | |
| `source` | `text` | `entered_1rm` \| `estimated_epley` \| `progressed` \| `manual` \| `default` |
| `effective_from` | `date` | default today |
| unique | `(exercise_id, effective_from)` | current TM = latest ≤ today |

### `t4m_program` (a mesocycle)
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `weeks` | `int` | check 4 or 6 |
| `days_per_week` | `int` | check 2..6 |
| `start_date` | `date` | |
| `status` | `text` | `active` \| `completed` \| `abandoned` |
| `generator_version` | `text` | |
| `input` | `jsonb` | the full frozen generator input — regenerating from `input` + `generator_version` must be byte-identical (there is a test) |
| `routine_id` | `uuid` FK → `t4m_routine`, nullable | set when this program was materialized from a builder-authored routine (chunk 18) rather than the generator |
| `created_at` | `timestamptz` | |
| `tm_changes` | `jsonb` nullable | `{exerciseId, from, to, reason}[]` — written by `startNextBlock` at the moment `rollOverTrainingMaxes()` actually runs, onto the program that just finished. `null` until then; read back by `/program/complete` (chunk 23) |

Partial unique index: only one `status = 'active'` row at a time
(`t4m_one_active_program`).

### `t4m_session`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `program_id` | `uuid` FK → `t4m_program` | |
| `week_number` / `day_number` | `int` | 1-based |
| `weekday` | `int` | |
| `scheduled_date` | `date` | |
| `archetype` | `text` | `FB-A`, `LOWER-SQ`, ... or `CUSTOM` for a builder-authored day (chunk 16's `Archetype` type — a superset of the generator's own `SessionArchetype`, kept separate so the generator's exhaustive pattern matches stay exhaustive over exactly what *it* can produce) |
| `title` | `text` | |
| `main_pattern` | `text` nullable | |
| `is_deload` | `bool` | |
| `estimated_sec` | `int` | from the time-budget engine (`src/core/timeBudget.ts`) |
| `blocks` | `jsonb` | **the runtime contract** — see §2 below |
| `status` | `text` | `planned` \| `in_progress` \| `completed` \| `skipped` |
| `started_at` / `completed_at` | `timestamptz` nullable | |
| `actual_sec` | `int` nullable | |
| `readiness_sleep` / `_soreness` / `_stress` | `int` nullable | 1..5 |
| `autoregulated` | `bool` | |
| `notes` | `text` nullable | |
| `routine_id` / `routine_day_id` | `uuid` FK, nullable | which routine/day this session was materialized from, when applicable |
| unique | `(program_id, week_number, day_number)` | |

### `t4m_logged_set`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `session_id` | `uuid` FK → `t4m_session` | |
| `block_letter` | `text` | |
| `slot` | `text` | `A1`, `B`, `D1`, `D2`, ... |
| `exercise_id` | `text` | |
| `set_number` | `int` | |
| `reps` | `int` nullable | |
| `weight_kg` | `numeric` nullable | |
| `rpe` | `numeric` nullable | |
| `distance_m` / `duration_sec` | `int` nullable | |
| `skipped` | `bool` | default false |
| `pain_flag` | `text` nullable | |
| `client_logged_at` | `timestamptz` | from the device — the outbox (`src/components/session/outbox.ts`) queues on this, offline-safe |
| `created_at` | `timestamptz` | server time |
| unique | `(session_id, block_letter, slot, set_number)` | makes offline replay idempotent — a re-sent queued row upserts, never duplicates |

Note: no `kind` column (ramp vs. working vs. backoff) — that lives only in
the session's `blocks` jsonb by slot/set-number. `src/server/analytics.ts`
documents the one place this simplification is visible: a ramp set counts
as one logged set in the volume charts, same as a working set.

### `t4m_pr`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `exercise_id` | `text` | |
| `kind` | `text` | `e1rm` \| `rep_max_3` \| `rep_max_5` \| `best_set` |
| `value` | `numeric` | |
| `reps` / `weight_kg` | nullable | the set that achieved it |
| `achieved_at` | `timestamptz` | |
| `session_id` | `uuid` FK, nullable | |

`src/server/analytics.ts`'s `e1rmSeries` computes its own running-max PR flag
independently of this table (chunk 20) — `t4m_pr` is written by the session
player at log time, not read back by the analysis charts.

### `t4m_pain_flag`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `area` | `text` | |
| `active_until` | `date` | flagged date + 14 days |
| `created_at` | `timestamptz` | |

### `t4m_routine`, `t4m_routine_day`, `t4m_routine_item` — the builder (chunk 18)
A routine is a reusable template — days of exercises with sets/reps/tempo —
distinct from a `t4m_program` (a scheduled, dated instance of one). Building
one is the "add and build my program myself" request from the original
task.

**`t4m_routine`**: `id`, `name`, `description` nullable, `source` (`custom` \|
`generated` — a program can be duplicated back into an editable routine),
`weeks` (1..16), `days_per_week` (1..7), `archived_at` nullable,
`created_at`/`updated_at`.

**`t4m_routine_day`**: `id`, `routine_id` FK, `day_index`, `name`, `weekday`
nullable (1..7), `notes` nullable. Unique `(routine_id, day_index)`.

**`t4m_routine_item`**: one exercise placement within a day.
`id`, `day_id` FK, `position`, `block_letter`, `block_kind` (`primer` \|
`main` \| `secondary` \| `superset` \| `finisher` \| `downregulate`),
`superset_group` nullable (items sharing a group are one superset),
`exercise_id`, `sets` (1..20), `rep_lo`/`rep_hi` nullable, `tempo` (default
`20X1`), `rest_sec` (default 120), `target_kind` (`percent_tm` \| `rpe` \|
`weight` \| `bodyweight` \| `duration` \| `distance`), `percent_tm`/`rpe`/
`weight_kg`/`duration_sec`/`distance_m` nullable depending on `target_kind`,
`per_side`, `notes` nullable. Unique `(day_id, position)`.

`src/core/builder/materializeRoutine.ts` turns a routine's days into
`t4m_session` rows with a `blocks` jsonb — the exact shape
`generateProgram.ts` also produces, independently (the "second producer"
pattern, §2). `src/components/builder/editable.ts`'s `fromRoutine`/
`toRoutineDays` are the pure round-trip between these three tables and the
client-side editing shape the builder UI actually works with.

### `t4m_custom_exercise`
An athlete-added exercise the static library doesn't have (§0). `id`,
`name`, `name_sv`, `pattern`, `tier` (default `T3`), `equipment[]`,
`primary_muscles[]`, `secondary_muscles[]`, `unilateral`, `metric` (default
`reps`), `default_tempo`, `rep_lo`/`rep_hi` (default 8/12), `cue`,
`created_at`.

---

## 2. The `blocks` jsonb — the runtime contract

`t4m_session.blocks` is a `SessionBlock[]` (shape defined in
`src/core/types.ts`) — the one thing the session player
(`src/components/session/SessionPlayer.tsx`) actually reads. Two independent
producers write this exact shape and neither knows about the other:
`src/core/generator/assembleSession.ts` (the mesocycle generator) and
`src/core/builder/materializeRoutine.ts` (the builder, chunk 18). Both are
pure functions, both are covered by their own tests against the same
`SessionBlock[]` contract. This is why the builder needed no changes to the
session player, logging, autoregulation, or the outbox — everything
downstream of `t4m_session.blocks` was already producer-agnostic.

## 3. RLS

Every `t4m_*` table: RLS enabled, one policy —

```sql
alter table t4m_session enable row level security;
create policy t4m_session_app on t4m_session
  for all to anon, authenticated using (true) with check (true);
```

No `auth.uid()` anywhere (§0). This is intentionally wide open at the
database layer; the PIN lock in `src/middleware.ts` is the actual access
control, in front of the whole app rather than per-row.

## 4. Indexes (live)

```sql
create index t4m_session_program on t4m_session (program_id, week_number, day_number);
create index t4m_session_date on t4m_session (scheduled_date);
create unique index t4m_session_program_id_week_number_day_number_key
  on t4m_session (program_id, week_number, day_number);
create index t4m_logged_exercise on t4m_logged_set (exercise_id, created_at desc);
create unique index t4m_logged_set_session_id_block_letter_slot_set_number_key
  on t4m_logged_set (session_id, block_letter, slot, set_number);
create unique index t4m_training_max_exercise_id_effective_from_key
  on t4m_training_max (exercise_id, effective_from);
create unique index t4m_one_active_program on t4m_program (status) where status = 'active';
create index t4m_routine_day_routine on t4m_routine_day (routine_id, day_index);
create unique index t4m_routine_day_routine_id_day_index_key
  on t4m_routine_day (routine_id, day_index);
create index t4m_routine_item_day on t4m_routine_item (day_id, "position");
create unique index t4m_routine_item_day_id_position_key
  on t4m_routine_item (day_id, "position");
```

## 5. TypeScript domain types

`src/core/types.ts` is the single source of truth for the domain — including
`Exercise`, `SessionBlock`, `PrescribedSet`, `Archetype`. There is
deliberately no `database.types.ts` generated-row-types layer: `src/server/`
reads/writes the `t4m_*` tables directly against hand-written interfaces
next to each query (e.g. `LoggedRow` in `src/server/analytics.ts`), because
generated row types would just be one more thing to keep in sync with the
`t4m_*` migrations by hand in a project with no CI codegen step. The
boundary that *is* enforced by tooling is `src/core` staying pure — no
Supabase import reaches it at all (`eslint.config.mjs`'s
`no-restricted-imports` rule).

## 6. Storage rules

- Weight: kilograms, `numeric`. Convert to lb at render only.
- Duration: seconds, integer. Distance: metres, integer.
- Dates without time: `date`. Timestamps: `timestamptz`, always UTC.
- Never store computed display strings.

---

## Appendix — the originally planned multi-user schema (not built)

Everything below this line is the schema this document specified before
chunk 21. It described a real multi-tenant product — `auth.uid()`-scoped
RLS, a `profiles` row per account, normalized `session_blocks` /
`block_exercises` / `prescribed_sets` tables instead of one `blocks` jsonb
column — none of which was ever implemented. It's kept verbatim, unedited,
as a record of that design, not as documentation of anything live. If this
app ever grows a second athlete, this is the starting point for that work,
not §1.

Postgres (Supabase). Every table with user data has RLS enabled and a policy
scoped to `auth.uid()`. No exceptions, no service-role reads from the browser.

### `profiles`
Mirrors `auth.users`, holds athlete settings.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | = `auth.users.id`, `on delete cascade` |
| `display_name` | `text` | |
| `units` | `text` | `metric` \| `imperial` — **display only**, storage is always kg |
| `experience` | `text` | `beginner` \| `intermediate` \| `advanced` |
| `days_per_week` | `int` | check 2..6 |
| `session_cap_seconds` | `int` | default 3600, check 1800..5400 |
| `equipment_profile` | `text` | see methodology §7 |
| `equipment_flags` | `jsonb` | `{ pull_up_bar: true, ... }` |
| `allow_advanced` | `bool` | default false |
| `pace_factor` | `numeric(4,2)` | default 1.00, check 0.80..1.30 |
| `preferred_weekdays` | `int[]` | 1..7, length = `days_per_week` |
| `mesocycle_weeks` | `int` | 4 or 6 |
| `created_at` / `updated_at` | `timestamptz` | |

### `exercises`
Reference data. **Not user-scoped.** `select` allowed to all authenticated users;
no insert/update/delete policy (seeded by migration only).

| Column | Type |
|---|---|
| `id` | `text` PK (slug) |
| `name` | `text` |
| `pattern` | `text` check ∈ taxonomy (methodology §4.1) |
| `tier` | `text` check ∈ `T1,T2,T3,T4` |
| `equipment` | `text[]` |
| `complexity` | `text` check ∈ `simple,moderate,advanced` |
| `unilateral` | `bool` |
| `loading_seconds_per_rep` | `numeric(4,1)` |
| `default_tempo` | `text` |
| `default_rep_lo` / `default_rep_hi` | `int` |
| `cue` | `text` |
| `alternatives` | `text[]` (exercise ids) |
| `contraindications` | `text[]` |
| `aliases` | `text[]` |
| `is_active` | `bool` default true |

### `training_maxes`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → profiles | |
| `exercise_id` | `text` FK → exercises | |
| `value_kg` | `numeric(6,2)` | |
| `source` | `text` | `entered_1rm` \| `estimated_epley` \| `progressed` \| `manual` |
| `effective_from` | `date` | |
| unique | `(user_id, exercise_id, effective_from)` | current TM = latest ≤ today |

### `programs` (a mesocycle)
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK | |
| `name` | `text` | e.g. "Block 2 · 4 weeks · 3 days" |
| `weeks` | `int` | 4 or 6 |
| `days_per_week` | `int` | |
| `start_date` | `date` | |
| `status` | `text` | `active` \| `completed` \| `abandoned` |
| `generator_version` | `text` | e.g. `gen-1.0.0` — bump on any rule change |
| `generator_input` | `jsonb` | **the full frozen input**: profile snapshot, TMs, seed |
| `created_at` | `timestamptz` | |

`generator_input` + `generator_version` must be sufficient to **regenerate the
program byte-identically**. There is a test for this.

Partial unique index: only one `status='active'` program per user.

### `sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `program_id` | `uuid` FK | |
| `user_id` | `uuid` FK | denormalised for RLS simplicity |
| `week_number` | `int` | 1-based |
| `day_number` | `int` | 1-based within the week |
| `scheduled_date` | `date` | |
| `archetype` | `text` | `FB-A`, `LOWER-SQ`, `AEROBIC-MOBILITY`, ... |
| `title` | `text` | "Squat day" |
| `estimated_seconds` | `int` | from the time-budget engine |
| `status` | `text` | `planned` \| `in_progress` \| `completed` \| `skipped` |
| `started_at` / `completed_at` | `timestamptz` | |
| `actual_seconds` | `int` | |
| `readiness_sleep` / `_soreness` / `_stress` | `int` | 1..5 |
| `readiness_score` | `int` generated | sum of the three |
| `autoregulated` | `bool` | set by §5.5 |
| `notes` | `text` | |
| unique | `(program_id, week_number, day_number)` | |

### `session_blocks`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK |
| `session_id` | `uuid` FK |
| `letter` | `text` | `A`..`F` |
| `kind` | `text` | `primer` \| `main` \| `secondary` \| `superset` \| `finisher` \| `downregulate` |
| `position` | `int` | ordering |
| `rounds` | `int` | supersets only |
| `rest_seconds` | `int` | block-level rest |
| `estimated_seconds` | `int` | |

### `block_exercises`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK |
| `block_id` | `uuid` FK |
| `exercise_id` | `text` FK |
| `slot` | `text` | `A1`, `B`, `D1`, `D2`, ... — shown to the athlete |
| `position` | `int` |
| `tempo` | `text` |
| `cue` | `text` | snapshotted from the exercise at generation time |
| `substituted_from` | `text` nullable | original exercise id if swapped |

### `prescribed_sets`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK |
| `block_exercise_id` | `uuid` FK |
| `set_number` | `int` |
| `set_kind` | `text` | `ramp` \| `working` \| `backoff` |
| `target_reps` | `int` nullable |
| `target_reps_per_side` | `bool` |
| `target_weight_kg` | `numeric(6,2)` nullable |
| `target_percent_tm` | `numeric(5,2)` nullable |
| `target_rpe` | `numeric(3,1)` nullable |
| `target_distance_m` | `int` nullable |
| `target_duration_seconds` | `int` nullable |
| `rest_seconds` | `int` |
| `estimated_seconds` | `int` |

### `logged_sets`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK |
| `prescribed_set_id` | `uuid` FK, nullable (for ad-hoc extra sets) |
| `session_id` | `uuid` FK | denormalised |
| `user_id` | `uuid` FK | |
| `exercise_id` | `text` FK | denormalised for history queries |
| `actual_reps` | `int` |
| `actual_weight_kg` | `numeric(6,2)` |
| `actual_rpe` | `numeric(3,1)` |
| `actual_distance_m` / `actual_duration_seconds` | `int` |
| `pain_flag` | `text` nullable | `knee` \| `shoulder` \| `lower-back` \| `elbow` \| `hip` \| `other` |
| `skipped` | `bool` default false |
| `client_logged_at` | `timestamptz` | from the device (offline-safe) |
| `created_at` | `timestamptz` | server time |
| unique | `(prescribed_set_id)` where not null | makes offline replay idempotent |

### `personal_records`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK |
| `user_id` / `exercise_id` | | |
| `kind` | `text` | `e1rm` \| `rep_max_3` \| `rep_max_5` \| `volume_set` |
| `value` | `numeric(7,2)` |
| `achieved_at` | `timestamptz` |
| `logged_set_id` | `uuid` FK |

### `pain_flags`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK |
| `user_id` | `uuid` |
| `area` | `text` |
| `active_until` | `date` | flagged date + 14 days |
| `created_at` | `timestamptz` |

### RLS (planned)

Enable on every table above except `exercises`.

```sql
alter table sessions enable row level security;
create policy sessions_owner on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`session_blocks`, `block_exercises` and `prescribed_sets` have no `user_id`;
their policies join up to `sessions`:

```sql
create policy session_blocks_owner on session_blocks for all
  using (exists (select 1 from sessions s
                 where s.id = session_blocks.session_id and s.user_id = auth.uid()));
```

`exercises`: `for select using (true)`, no write policy at all.

A `profiles` row is created by a trigger on `auth.users` insert.

### Indexes (planned)

```sql
create index on sessions (user_id, scheduled_date);
create index on sessions (program_id, week_number, day_number);
create index on logged_sets (user_id, exercise_id, created_at desc);
create index on training_maxes (user_id, exercise_id, effective_from desc);
create unique index one_active_program on programs (user_id) where status = 'active';
```
