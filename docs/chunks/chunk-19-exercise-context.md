# Chunk 19 — "Last time / expected from your 1RM"

**Depends on:** 16 (taxonomy), 17 (picker) — but the server function can be
built any time. **Size:** S. Highest value-per-line in the plan.

## Mission

> "When I choose an exercise and build my program, I want to see what I did last
>  time for that same exercise OR what is expected of it given my 1RM."

One function, surfaced in four places.

## 1. The function

`src/server/exerciseContext.ts`:

```ts
export interface ExerciseContext {
  exerciseId: string;
  last: {
    date: string;            // ISO date of the most recent session containing it
    daysAgo: number;
    sessionTitle: string | null;
    topSet: { weightKg: number | null; reps: number | null; rpe: number | null };
    allSets: { weightKg: number | null; reps: number | null; rpe: number | null }[];
    totalVolumeKg: number;
  } | null;
  best: {
    e1rm: number;            // Epley, from the best logged set
    weightKg: number; reps: number; date: string;
  } | null;
  /** Direct TM, or derived from the pattern anchor via resolveTrainingMax. */
  trainingMax: { valueKg: number; derivedFrom: string | null } | null;
  /** What the app would prescribe: TM × percent, rounded to the increment. */
  expected: { percentTm: number; weightKg: number; repRange: [number, number] } | null;
}

export async function exerciseContext(
  exerciseIds: string[],
  opts?: { percentTm?: number },
): Promise<Record<string, ExerciseContext>>;
```

Implementation notes:

- **One query for the batch**, not one per exercise. `t4m_logged_set` is indexed
  on `(exercise_id, created_at desc)`; select where `exercise_id in (...)` and
  `skipped = false`, ordered `created_at desc`, then fold in JS. The picker will
  call this with 30+ ids at once — an N+1 here would undo chunk 14.
- Reuse, do not reimplement: `epley` and `resolveTrainingMax` from
  `src/core/progression/trainingMax.ts`, `roundToIncrement` from `waves.ts`.
- `expected` is `null` when there is no TM and no anchor — say "not enough data
  yet", never show a fabricated number. This mirrors how `prescriptionFor`
  already falls back to RPE when a TM is missing, and that honesty is a
  deliberate property of the app.
- Cache with `unstable_cache` tagged `logs`; `logSets` and `finishSession`
  already have the mutation hooks to `revalidateTag('logs')` after chunk 14.

## 2. The component

`src/components/exercise/ExerciseContextLine.tsx` — one compact line, and
`ExerciseContextPanel.tsx` — the expanded version.

Copy, in priority order:

| State | Line |
|---|---|
| Logged before | `Last: 100 kg × 5 @8 · 12 days ago` |
| Never logged, TM known | `Expected: 82 % of 145 kg → 120 kg × 3` |
| Never logged, no TM | `No history yet — first session sets the baseline` |

When both exist, the line shows *last time* (it is the more useful number) and
the panel shows both, with the delta: `+2.5 kg vs last time`.

## 3. Where it appears

1. **Exercise picker rows** (chunk 17 / 18) — `ExerciseContextLine` as the row's
   secondary text. Batch-fetched for the visible page of results.
2. **Builder item editor** (chunk 18 §4.3) — `ExerciseContextPanel`, and when
   `target_kind: 'percent_tm'`, live-update the resolved kg as the percent
   slider moves.
3. **Exercise detail page** (chunk 17 §2.4) — the panel, plus the chart.
4. **Session player** — above the first `SetRow` of each exercise, so the
   number is there when it matters most. This is a small addition to
   `SessionPlayer.tsx`: pass a `contexts` prop down from the server page
   (`src/app/session/[id]/page.tsx`), which already loads the session and can
   batch one extra query.

## Acceptance

- [ ] Picking any exercise anywhere shows last-time or expected, never both
      absent without an explanatory line.
- [ ] Opening a 30-row picker issues **one** context query, not 30.
- [ ] Numbers agree with what the generator would prescribe for the same TM and
      percent — add a test asserting `expected.weightKg` equals
      `prescriptionFor(...)`'s working weight for the same inputs.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build` clean.
