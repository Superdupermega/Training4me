# Chunk 20 — Profile: the log & data analysis view

**Depends on:** 15 (routes), 19 (context helpers). **Size:** L.

## Mission

> "I want the log and data analysis page to be super advanced but user-friendly
>  (that can be in the profile page)"

`/profile` answers four questions, in this order, above the fold on a phone:
**Am I getting stronger? Am I training enough? Is anything unbalanced? What are
my records?** Everything else is a drill-down.

"Super advanced but user-friendly" resolves as: **one headline number per
question, with the depth one tap behind it.** Not a wall of charts.

## 1. Page structure

```
/profile
  ├─ header: name, current block, streak, sessions this week
  ├─ [Strength] [Volume] [Consistency] [Records] [Body]   ← M3 tabs
  └─ /profile/settings        (the old /settings, moved)
```

Tabs, not one long scroll — a phone scroll through six charts is the opposite
of user-friendly.

### Tab 1 — Strength
- **Headline:** estimated 1RM change across the current block, per main lift,
  as a signed delta (`Back Squat +7.5 kg`).
- e1RM line chart per lift (select from a chip row), PRs marked as dots.
- Training-max history table (`t4m_training_max` already stores
  `effective_from`, so this is a free query).
- Per-lift drill-down links to `/exercises/[id]`.

### Tab 2 — Volume
- **Headline:** working sets this week vs. your 4-week average.
- Weekly tonnage bar chart (kg lifted, working sets only, ramps excluded — reuse
  the `kind !== 'ramp'` rule the balance code already uses).
- **Sets by muscle group**, stacked bar per week. This is the payoff for chunk
  16's taxonomy and the most genuinely useful chart in the app.
- Intensity distribution: sets bucketed by % of TM (< 65, 65–75, 75–85, 85 +).
- Push/pull and upper/lower ratios, with the same 1:1-ish guidance the balance
  rules encode.

### Tab 3 — Consistency
- **Headline:** completed / planned sessions this block, as a percentage.
- Calendar heatmap, 12 months, one cell per day, intensity = working sets.
- Estimated vs. actual session duration (the app already computes `paceFactor`
  from exactly this — surface it instead of hiding it in Settings).
- Readiness over time (sleep/soreness/stress are stored per session), plotted
  against the same week's tonnage. Present it as an observation, never a
  prescription.

### Tab 4 — Records
- The current `/history` PR list, expanded: per exercise, best e1RM, best 3RM,
  best 5RM, best set, each with the date and a link to the session.
- Filter by muscle group.

### Tab 5 — Body
- Bodyweight over time, plus optional waist/notes. Needs a new table:
  ```sql
  create table t4m_body_metric (
    id uuid primary key default gen_random_uuid(),
    measured_on date not null unique,
    bodyweight_kg numeric(5,2), waist_cm numeric(5,2), notes text,
    created_at timestamptz not null default now()
  );
  ```
  RLS + `t4m_body_metric_app` policy, same pattern as every other `t4m_` table.
- Neutral by design: no goals, no targets, no judgement. Plot bodyweight against
  tonnage and stop there.

## 2. The full log

`/history` stays the session feed. Add `/history/[sessionId]` — a read-only
replay of a finished session: every block, every set as logged, readiness,
duration, notes, and a diff against what was prescribed (`t4m_session.blocks`
holds the prescription; `t4m_logged_set` holds reality). That diff is the single
most interesting screen for a lifter and it costs one join.

## 3. Charts — no library

Hand-rolled SVG in `src/components/charts/`. The dataset is one person's
training log; a charting dependency is not worth the bundle after chunk 14.

Primitives to build, in this order:
`<LineChart>`, `<BarChart>`, `<StackedBarChart>`, `<Heatmap>`, `<Sparkline>`.

Shared rules — **read `docs/04-DESIGN-SYSTEM.md` and the `dataviz` skill before
writing the first chart**:
- colours from theme tokens only (`theme.vars.palette.*`), correct in light and
  dark, never hard-coded hex;
- `viewBox` + `preserveAspectRatio`, `width: 100%` — responsive without JS;
- tabular figures on every axis label (the `.tnum` class already exists);
- touch targets ≥ 44 px for any interactive point;
- an accessible fallback: every chart is preceded by a visually-hidden `<table>`
  of the same data;
- **empty states are part of the component**, not an afterthought — see §4.

## 4. Empty states

`t4m_logged_set` currently has **zero rows**. Every chart must render something
useful with 0, 1 and 2 data points:

- 0 points → an outlined card: what this chart will show, and what to do to fill
  it ("Log three sessions and your weekly volume appears here").
- 1 point → the number, large, with "one session so far".
- 2+ → the chart.

Add `scripts/seed-demo-log.ts` — a dev-only script, refusing to run unless
`ALLOW_DEMO_SEED=1` **and** `NODE_ENV !== 'production'`, that writes ~8 weeks of
plausible logged sets so these views can actually be built and reviewed. It must
also be able to delete exactly what it inserted.

## 5. Queries

Add to `src/server/analytics.ts` (new, server-only). One function per view, each
a single round-trip, each `unstable_cache`d and tagged `logs`:

```ts
weeklyVolume(weeks: number)
volumeByMuscleGroup(weeks: number)     // joins logged sets → library muscle data in JS
e1rmSeries(exerciseId: string)
intensityDistribution(programId: string)
consistency(programId: string)
calendarActivity(days: number)
readinessSeries(limit: number)
```

Muscle-group attribution happens in JS against the static library, not in SQL —
the library lives in TypeScript, which is a deliberate v1 decision recorded in
`docs/DECISIONS.md`. Credit a set's volume to its primary muscles only, split
evenly; do not weight secondaries. Say so in a footnote on the chart, because an
unexplained number is worse than a simple one.

## Acceptance

- [ ] Each of the four questions in §Mission is answered by a single headline
      number visible without scrolling on a 390 px-wide screen.
- [ ] Every chart is legible in light and dark, and readable at arm's length.
- [ ] Every chart handles 0, 1 and 2 data points without breaking.
- [ ] `/history/[sessionId]` shows prescribed vs. actual.
- [ ] No charting dependency added.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build` clean.
