# 02 — DATA MODEL

Postgres (Supabase). Every table with user data has RLS enabled and a policy
scoped to `auth.uid()`. No exceptions, no service-role reads from the browser.

---

## 1. Tables

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

---

## 2. RLS

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

## 3. Indexes

```sql
create index on sessions (user_id, scheduled_date);
create index on sessions (program_id, week_number, day_number);
create index on logged_sets (user_id, exercise_id, created_at desc);
create index on training_maxes (user_id, exercise_id, effective_from desc);
create unique index one_active_program on programs (user_id) where status = 'active';
```

## 4. TypeScript domain types

`src/core/types.ts` is the single source of truth for the domain. Supabase's
generated types (`src/lib/database.types.ts`) are **row types only** and are
never used in `src/core`. Repositories in `src/server/repositories/` map
between the two, and a test asserts the two enum sets are identical — if a
migration adds a pattern and `core/types.ts` doesn't, CI fails.

## 5. Storage rules

- Weight: kilograms, `numeric(6,2)`. Convert to lb at render only.
- Duration: seconds, integer.
- Distance: metres, integer.
- Dates without time: `date`. Timestamps: `timestamptz`, always UTC.
- Never store computed display strings.
