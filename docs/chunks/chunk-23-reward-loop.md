# Chunk 23 — The reward loop

**Depends on:** chunk 22 (uses its `display` type variants). **Size:** L.
**Read first:** `docs/10-FEEL-AND-POLISH.md` §3 and §4.

The app records training faithfully and never reacts to it. This chunk is
everything that happens *after* the sets are logged.

Findings closed: #4, #5, #6, #7, #8.

---

## 1. The block retrospective

**Problem.** You finish four weeks and the app says nothing. Worse, it
already computes the interesting part and throws it away:
`src/server/actions.ts:286` is

```ts
await rollOverTrainingMaxes();
```

`rollOverTrainingMaxes()` (`src/server/nextBlock.ts`) **returns**
`{ exerciseId, from, to, reason }[]` — every training max that moved, by how
much, and why ("squat: all reps at RPE 8, full jump"). The result is
discarded on that line and the next block is generated immediately after.

**Do.**

- New pure aggregator `src/core/progression/retrospective.ts`. Input: the
  block's sessions, its logged sets, and the TM changes array. Output: total
  tonnage, sets logged vs. planned, sessions completed / skipped, adherence
  as a fraction, PRs achieved during the block, the peak-week top set per
  main pattern, and the TM deltas. **Pure** — no DB, no dates from the
  ambient clock, everything passed in. Unit test it directly; this is the
  kind of thing `src/core` exists for.
- New route `src/app/program/complete/page.tsx` rendering that summary. Use
  chunk 22's `displayMedium` for the headline numbers and the gold
  `tertiary` role for PR rows.
- Change `startNextBlock` to **capture** the return value of
  `rollOverTrainingMaxes()` rather than discarding it, and make the
  retrospective reachable with it. Two acceptable shapes — pick one and
  record the choice in `DECISIONS.md`:
  1. `startNextBlock` returns the changes in its `Result<T>` payload and the
     caller routes to `/program/complete` with them in component state; or
  2. the retrospective page recomputes from the just-completed program by id
     (more robust across a reload, one extra query).

  Shape 2 is the safer default — a retrospective that vanishes on refresh is
  the same non-event you are fixing. If you take shape 1, say why.
- Entry point: when the last session of a block is finished, `/today` offers
  "See how the block went" alongside whatever it offers now. Do not
  auto-redirect out of the session summary — finishing a session and
  finishing a block are different moments and stacking them buries both.

**Do not** change what `rollOverTrainingMaxes` computes, or when TMs roll
over. This is display of an existing decision, not a new one.

## 2. The PR moment

**Problem.** `SessionSummary.tsx` renders `EmojiEventsIcon` next to a
number. The `tertiary` (gold) palette role exists specifically for this and
is otherwise used for one 4.5px dot in `LineChart`.

**Do.** When a finished session produced PRs, show them as a real moment
before the set-by-set summary: full-width, gold `tertiaryContainer` ground,
the lift and the number at `displayLarge`, one card per PR. `formatPr()` and
the `PR_LABEL` map already exist in that file — reuse them.

Motion, under the global reduced-motion guard: the card scales in from ~0.96
and the number counts up over ~600ms. Nothing that blocks — no modal, no
dismiss required, no confetti library. It is a card that arrives, not an
interruption.

**Edge case that matters:** editing a set in the summary re-runs PR
detection and can *revoke* a PR. The moment must re-render off the current
`prs` prop, not a snapshot taken on mount, or it will keep celebrating a
record that no longer exists.

## 3. Charts worth looking at

**Problem.** `src/components/charts/LineChart.tsx` is a fixed 400×180
viewBox, one path, min and max as corner text. No x-axis labels, no
gridlines, no fill, no interaction, no sense of change.

**Do**, in `LineChart.tsx` (`BarChart` gets 3.1 and 3.2 only):

1. **Area fill.** A `<linearGradient>` from `primary.main` at ~0.18 alpha to
   transparent, under the existing path. Define the gradient with a **unique
   id per instance** — two charts on one page with the same `id` will make
   the second one reference the first's gradient. `useId()` is the right
   tool and does not make the component client-side.
2. **X-axis labels.** First, middle and last `point.label` only. Every label
   on a 12-point series is unreadable at 400px wide.
3. **A delta headline.** Above each chart: the change from first to last
   point, formatted and signed — `+7.5 kg over 8 weeks`. This is the single
   highest-value addition in this section and the cheapest; it is a
   subtraction and a `<Typography>`.
4. **Tap-to-inspect.** Each point gets an enlarged transparent hit area
   (≥ 24px, the visible dot stays 3–4.5px) that reveals the label and value.
   **This makes the component client-side** — it currently ships zero JS.
   Either accept that and mark it `'use client'`, or implement the reveal
   with a CSS `:focus-within` / `:hover` sibling selector and keep it
   server-rendered. **Prefer the CSS route**; if you go client, report the
   `/profile` bundle delta in `PROGRESS.md`.

**Keep the visually-hidden `<table>` fallback in every chart.** It is how
these are accessible at all. Adding visual richness must not cost that.

## 4. The body map

**Problem.** `volumeByMuscleGroup()` in `src/server/analytics.ts` returns
exactly the data. The only visual for it is `MuscleCoverageStrip` — a row of
chips — and it lives in the *builder*, not on the analysis page.

**Do.**

- New `src/components/charts/BodyMap.tsx`: anterior and posterior
  silhouettes as inline SVG, one `<path>` per muscle group, filled by
  weekly set count.
- The path-id → `MuscleGroup` mapping is the load-bearing part. Key it off
  the `MuscleGroup` union in `src/core/library/muscles.ts` so a group added
  later is a **typecheck failure**, not a silently unfilled shape. Use a
  `Record<MuscleGroup, string>` for the path data — exhaustive by
  construction.
- Shading: reuse `Heatmap.tsx`'s existing threshold approach
  (`action.hover` → `primaryContainer.main` → `primary.light` →
  `primary.main`) so the two visuals agree. Do not invent a second scale.
- Render it on the volume tab (`src/components/profile/VolumeTab.tsx`)
  alongside the existing bar chart, not instead of it — the bars carry the
  numbers, the map carries the shape.
- Accessible fallback, same as every other chart: a visually-hidden table of
  group → set count.

The silhouettes do not need to be anatomically beautiful. Two readable
outlines with distinguishable regions beat a detailed drawing nobody can
map to a muscle group.

## 5. Session notes

**Problem.** `t4m_session.notes` is in the schema
(`docs/02-DATA-MODEL.md` §1) and **nothing in the app writes or reads it**.

**Do.**

- A notes field in `SessionSummary.tsx` — the finished-session view, where
  you have a moment, not mid-set where you do not.
- Save through a new action in `src/server/actions.ts`:
  `await requireUnlocked()` first, then `repo.updateSession(id, { notes })`
  — which already exists and takes a patch. Debounce or save on blur; do not
  fire per keystroke.
- Show the note on the history row when one exists
  (`src/app/history/page.tsx`), truncated to a line. A note you cannot see
  from the list is a note you will never re-read.
- Include `notes` in both exports (`src/server/export.ts`, JSON and CSV).
  Check the CSV column list explicitly — a new field that silently misses
  the export is exactly the drift `docs/02-DATA-MODEL.md` warns about.

## 6. Tests

- `retrospective.ts` gets direct unit tests: tonnage, adherence with skipped
  sessions, a block with zero logged sets, a block where no TM moved.
- `analytics.test.ts`: extend for the delta calculation if you put it
  server-side.
- `BodyMap`: assert every `MuscleGroup` in the union has a path — a test
  that iterates the union and fails on a missing key is worth more than any
  render assertion here.
- Notes: assert the action calls `requireUnlocked` and that a saved note
  appears in both export formats.

## Acceptance

- [ ] `startNextBlock` no longer discards `rollOverTrainingMaxes()`'s result.
- [ ] A finished block has a retrospective reachable from `/today`, showing
      TM deltas with their reasons, tonnage, adherence and PRs.
- [ ] The retrospective survives a page refresh.
- [ ] PRs get a real moment in the session summary, and it disappears if an
      edit revokes the PR.
- [ ] Charts have area fill, three x-labels, a signed delta headline, and
      inspectable points; the hidden-table fallback is intact on all of them.
- [ ] Gradient ids are unique per instance.
- [ ] `BodyMap` covers every `MuscleGroup` and fails to typecheck if one is
      added without a path.
- [ ] Session notes save, appear in history, and are in both exports.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.
