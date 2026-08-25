# Chunk 18 — Program builder

**Read first:** `docs/06-REDESIGN-PLAN.md` §3 (the architectural spine).
**Depends on:** 15, 16, 17. **Size:** L — the biggest chunk. Consider splitting
18a (schema + core materialiser + tests) from 18b (UI).

## Mission

Let the user build a program themselves — days, exercises, sets, reps, tempo,
rest, supersets — and train it in the existing session player.

## 1. The one rule

The builder is a **second producer of `SessionBlock[]`**. It gets no player of
its own, no logging path of its own, no progression code of its own. A routine
is materialised into `t4m_session` rows with the same `blocks` JSONB the
generator writes, and from that moment the app cannot tell the difference.

## 2. Schema

Apply as one migration. Every table needs RLS enabled plus a policy exactly
matching the existing pattern, or the publishable key cannot reach it:

```sql
alter table <t> enable row level security;
create policy <t>_app on <t> for all to anon, authenticated
  using (true) with check (true);
```

```sql
create table t4m_routine (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  source text not null default 'custom' check (source in ('custom','generated')),
  weeks int not null default 4 check (weeks between 1 and 16),
  days_per_week int not null default 3 check (days_per_week between 1 and 7),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table t4m_routine_day (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references t4m_routine(id) on delete cascade,
  day_index int not null,
  name text not null,
  weekday int check (weekday between 1 and 7),
  notes text,
  unique (routine_id, day_index)
);

create table t4m_routine_item (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references t4m_routine_day(id) on delete cascade,
  position int not null,
  block_letter text not null,
  block_kind text not null default 'secondary'
    check (block_kind in ('primer','main','secondary','superset','finisher','downregulate')),
  superset_group text,
  exercise_id text not null,
  sets int not null default 3 check (sets between 1 and 20),
  rep_lo int, rep_hi int,
  tempo text not null default '20X1',
  rest_sec int not null default 120,
  target_kind text not null default 'rpe'
    check (target_kind in ('percent_tm','rpe','weight','bodyweight','duration','distance')),
  percent_tm numeric(5,2), rpe numeric(3,1), weight_kg numeric(6,2),
  duration_sec int, distance_m int,
  per_side boolean not null default false,
  notes text,
  unique (day_id, position)
);

create table t4m_custom_exercise (
  id text primary key,
  name text not null, name_sv text not null default '',
  pattern text not null, tier text not null default 'T3',
  equipment text[] not null default '{}',
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  unilateral boolean not null default false,
  metric text not null default 'reps',
  default_tempo text not null default '20X1',
  rep_lo int not null default 8, rep_hi int not null default 12,
  cue text not null default '',
  created_at timestamptz not null default now()
);

alter table t4m_profile add column if not exists favourite_exercises text[] not null default '{}';
alter table t4m_session  add column if not exists routine_id uuid references t4m_routine(id);
alter table t4m_session  add column if not exists routine_day_id uuid references t4m_routine_day(id);
alter table t4m_program  add column if not exists routine_id uuid references t4m_routine(id);

create index t4m_routine_day_routine on t4m_routine_day (routine_id, day_index);
create index t4m_routine_item_day    on t4m_routine_item (day_id, position);
```

Note `t4m_session.blocks` and `t4m_program` are otherwise unchanged — a
custom-routine program is just a program whose `routine_id` is set.

## 3. Core: the materialiser (pure, tested)

New `src/core/builder/`:

- `types.ts` — `Routine`, `RoutineDay`, `RoutineItem` (mirrors the schema).
- `materializeRoutine.ts` —
  ```ts
  export function materializeRoutine(
    routine: Routine,
    args: { startDate: string; weeks: number; trainingMaxes: Record<string, number>;
            increment: number; paceFactor: number },
  ): PlannedWeek[];
  ```
  Rules:
  - group items by `block_letter` into `SessionBlock`s, ordered A, B, C…;
  - items sharing a `superset_group` become one block with `rounds` = max sets
    and `kind: 'superset'`, slots `D1`, `D2`, …; standalone items get slot =
    block letter;
  - `target_kind: 'percent_tm'` resolves through the existing
    `resolveTrainingMax(exerciseId, pattern, trainingMaxes)` and
    `roundToIncrement` — reuse `src/core/progression/`, do not reimplement;
  - `target_kind: 'rpe' | 'weight' | 'bodyweight'` map straight onto
    `PrescribedSet`;
  - every set gets `estimatedSec` from the existing `src/core/tempo.ts` +
    `timeBudget.ts` cost model, so the estimate is computed the same way the
    generator's is;
  - **no trimming.** The generator trims to fit a cap; the builder reports the
    estimate and lets the user decide. Their program, their call.
- `progressRoutine.ts` (optional, only if trivially clean) — apply a linear or
  wave progression across `weeks` when the user asks for one. If it is not
  clean, ship week-identical repetition and put progression in the backlog.

Tests (`src/core/builder/*.test.ts`), all pure:
- a one-day, three-item routine materialises to one session with three blocks;
- a superset group produces one block, `rounds` correct, slots `D1`/`D2`;
- `percent_tm` with a known TM produces the expected rounded weight;
- `percent_tm` with **no** TM falls back to an RPE target, never to `0 kg`;
- estimated seconds are within 5 % of the same sets costed by the generator's
  path — proof the two producers agree.

## 4. UI: `/program/builder`

Three screens, full-screen (no nav), each with a back arrow.

**4.1 Routine setup** — name, weeks, days per week, optional weekday mapping.

**4.2 Day editor** — the core screen.
- Tabs or a horizontal day strip across the top (Day 1 · Day 2 · …).
- A day is a vertical list of items grouped by block letter, each row showing
  exercise name, `3 × 8–10`, tempo, rest, and the target.
- **Add exercise** opens the chunk-17 picker in a full-screen dialog, with the
  chunk-19 last-time line on every row.
- **Reorder** by drag. Use HTML5 drag-and-drop with pointer events, or
  `@dnd-kit/core` if hand-rolling proves fragile — but check the bundle cost
  against chunk 21's budget before adding a dependency. An up/down arrow
  fallback must exist for accessibility regardless.
- **Superset**: multi-select rows → "Make superset" → they collapse into one
  lettered block.
- A live **estimated duration** chip in the app bar, recomputed on every edit
  from `materializeRoutine` (it is pure and fast — call it directly on the
  client).

**4.3 Item editor** (bottom sheet) — sets, rep range, tempo (with a plain-English
explainer: `30X1` = 3 s down, no pause, explosive up, 1 s at the top), rest,
target kind, and per-side. Shows the chunk-19 panel: *last time* and *expected
from your TM*.

## 5. Scheduling a routine

`/program` gains a routine list. "Start this routine" →
`materializeRoutine` → `persistRoutineProgram()` (mirrors the existing
`persistProgram`: abandon the active program, insert the new one with
`routine_id`, insert sessions). The confirmation dialog must say plainly what
happens to the current block, reusing the wording already in `SettingsForm`.

Also add "Duplicate as a routine" on a generated program, so the user can start
from the generator's output and edit it. This is likely how they will actually
use the app, and it is cheap: `program.plan[0]` → routine rows.

## 6. Advisory warnings — warn, never block

After materialising, run the *read-only* half of the balance checks
(`countWeek` + `validateWeek` from `src/core/generator/balance.ts`) and surface
violations as dismissible `Alert severity="info"` cards:

> "This week has 18 pushing sets and 6 pulling sets. Most people feel better
>  around 1:1."

Never refuse to save. Never auto-repair. `repairWeek` is generator-only.

## Acceptance

- [ ] A routine can be created, edited, reordered, superset, saved, scheduled
      and played in the existing `SessionPlayer` with no player changes.
- [ ] `percent_tm` items show the right load for the user's actual TMs.
- [ ] The live duration estimate agrees with the generator's cost model.
- [ ] Balance advice appears and can be ignored.
- [ ] Generator paths untouched: `matrix.test.ts` green.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build` clean.

## Do not

- Do not fork `SessionPlayer`, `SetRow`, `outbox.ts` or the logging path.
- Do not put DB access in `src/core` — the lint rule will catch it.
- Do not let the builder call `repairWeek`.
