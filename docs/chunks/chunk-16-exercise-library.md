# Chunk 16 — Exercise library: muscle taxonomy, expansion, Filly set

**Read first:** `docs/06-REDESIGN-PLAN.md` §6 (risks — read the first two rows
twice). **Depends on:** nothing in code; blocks 17, 18, 19. **Size:** L.

## Mission

The library has 93 movements classified by *movement pattern* only. There is no
muscle-group axis, so "browse by muscle group" cannot be built. Add the
taxonomy, then grow the library to ~300 movements including a substantial
Functional Bodybuilding (Marcus Filly) set — **without changing a single
generated program.**

## 1. The containment rule — read before writing any data

`query.find()` selects across all of `EXERCISES`, and the balance rules and
volume bands in `src/core/generator/balance.ts` were tuned against 93 movements.
Adding 200 more would silently reshape every generated block and probably break
`matrix.test.ts`.

So: add to `Exercise` in `src/core/types.ts`

```ts
/** Omitted or true = the generator may select it. New library-only movements
 *  ship false: visible in the browser and the builder, invisible to the
 *  generator. Opt in one at a time, re-running the matrix each time. */
inGeneratorPool?: boolean;
```

and in `src/core/library/query.ts`, `find()` gains
`if (ex.inGeneratorPool === false) return false;`.

**Every movement added in this chunk ships `inGeneratorPool: false`.** The 93
existing ones are untouched. The matrix test then stays green by construction,
which is the point.

## 2. Muscle taxonomy

New file `src/core/library/muscles.ts`:

```ts
export const MUSCLES = [
  'chest', 'front_delt', 'side_delt', 'rear_delt', 'rotator_cuff',
  'triceps', 'biceps', 'forearms', 'grip',
  'lats', 'mid_back', 'traps', 'lower_back',
  'abs', 'obliques', 'hip_flexors',
  'glutes', 'quads', 'hamstrings', 'adductors', 'abductors',
  'calves', 'tibialis', 'neck', 'cardio',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'arms', 'core',
  'quads', 'hamstrings_glutes', 'calves',
  'carry_grip', 'cardio', 'mobility', 'full_body',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const GROUP_MUSCLES: Record<MuscleGroup, Muscle[]> = { /* … */ };
export const MUSCLE_LABEL: Record<Muscle, string> = { /* … */ };
export const GROUP_LABEL: Record<MuscleGroup, string> = { /* … */ };

/** Derived, never hand-authored: a movement's groups come from its primaries. */
export function groupsFor(primary: Muscle[]): MuscleGroup[];
```

Extend `Exercise`:

```ts
primaryMuscles: Muscle[];        // 1–3, required
secondaryMuscles: Muscle[];      // 0–5, default []
mechanic: 'compound' | 'isolation';
force: 'push' | 'pull' | 'static' | 'carry' | 'locomotion';
styles: ExerciseStyle[];         // default []
skillGated?: boolean;
howTo?: string[];                // 2–5 imperative steps, for the detail page
inGeneratorPool?: boolean;
```

```ts
export const EXERCISE_STYLES = [
  'functional_bodybuilding', 'powerlifting', 'bodybuilding',
  'strongman', 'conditioning', 'mobility', 'rehab_prehab',
] as const;
```

The `mk()` helper in `exercises.ts` supplies the defaults, exactly as it does
for `complexity`/`metric` today. **Backfill `primaryMuscles`, `secondary`,
`mechanic` and `force` on all 93 existing movements** — that is required work,
not optional; the browser needs it.

## 3. The skill-gate fix

`exercises.test.ts` currently bans ids containing `snatch`, `clean`,
`muscle-up`, `kipping`, `handstand`, `pistol`. That rule exists so the
*generator* never prescribes a skill lift unsupervised — keep the intent, drop
the blunt instrument. Replace that test with:

```ts
it('never lets the generator select a skill-gated movement', () => {
  for (const e of EXERCISES.filter((x) => x.skillGated)) {
    expect(e.complexity).toBe('advanced');
    expect(e.inGeneratorPool).toBe(false);
  }
});
```

That unblocks KB clean, KB snatch, pistol squat and get-ups for the builder,
which the user explicitly wants, while the generator behaviour is unchanged.

## 4. Expansion targets

Roughly 300 total. Per group, minimum counts (the browser needs every group to
feel populated — this is the "extensive exercise list" ask):

| Group | Min | Notes |
|---|---|---|
| Chest | 24 | flat/incline/decline × barbell/DB/machine/cable/ring/bodyweight, flyes, deficit and tempo push-ups |
| Back | 38 | rows (barbell, Pendlay, seal, chest-supported, landmine/Meadows, single-arm, ring, inverted), pulldowns, pull-ups/chin-ups by grip, straight-arm, shrugs, rack pulls |
| Shoulders | 30 | strict/push press/jerk, Z-press, Arnold, half- and tall-kneeling, landmine, bottoms-up, lateral & rear raises, Y/T/W, cuff work |
| Arms | 32 | curls (barbell, EZ, DB, hammer, incline, preacher, cable, spider), extensions (skullcrusher, overhead, pushdown, JM, dips), forearm/grip |
| Core | 26 | anti-extension, anti-rotation, anti-lateral-flexion, flexion, hanging, GHD, Copenhagen |
| Quads | 32 | squat variants (back/front/box/pause/tempo/Zercher/cyclist/goblet/safety-bar), split squats, lunges, step-ups, skater, sissy, leg press/extension |
| Hamstrings & glutes | 30 | deadlift family, RDL variants incl. kickstand and single-leg, good mornings, hip thrust incl. B-stance, back extension, Nordic, leg curls, reverse hyper |
| Calves | 10 | standing/seated/single-leg/tibialis |
| Carry & grip | 14 | farmer, suitcase, front rack, waiter, overhead, mixed, yoke-ish, sled push/drag forward and backward, dead hang |
| Cardio | 14 | Z2 and interval variants across bike/row/ski/run/walk/ruck/jump rope |
| Mobility | 22 | keep the 10 existing, add hip/t-spine/ankle/shoulder work |
| Full body | 12 | get-ups, sandbag over shoulder, KB complexes, bear crawl, wall walk |

## 5. The Functional Bodybuilding (Marcus Filly) set

Tag ≥ 50 movements `styles: ['functional_bodybuilding']`. These are movements
**characteristic of that training style** — write them as normal library
entries, not as a branded sub-product. Cover at least:

- Dual-KB front rack: squat, reverse lunge, carry, march
- Bottoms-up KB press (half-kneeling, tall-kneeling), waiter walk
- Half-kneeling and tall-kneeling landmine press; landmine row; Meadows row
- Tempo ring row, ring push-up, ring dip, tempo strict pull-up
- Chest-supported incline DB row, seal row, bird-dog row
- Kickstand RDL, B-stance hip thrust, single-leg box squat, skater squat
- Zercher squat, Zercher carry, sandbag bear-hug squat, sandbag over shoulder
- Sled push, sled drag (forward and backward)
- Copenhagen plank, Nordic curl eccentric, GHD hip extension
- DB Z-press, Arnold press, Powell raise, prone Y/T/W
- Deficit reverse lunge, cyclist (heels-elevated close-stance) squat
- Turkish get-up, dead hang, hollow/arch holds, bear crawl
- Echo/assault bike and row intervals

Every FB entry needs a real `cue`, a genuine `defaultTempo` (tempo is central to
the style — `31X1`, `40X1`, `3011` are typical), `restSec`-friendly rep ranges,
and correct `primaryMuscles`.

New `Equipment` values needed: `rings`, `landmine`, `sandbag`, `machine`,
`ghd`, `sled` (exists). Add them to `EQUIPMENT` in `types.ts`, to
`EQUIPMENT_LABEL` and to `PROFILE_EQUIPMENT.full_gym` in
`src/core/library/equipment.ts`. **Do not** add them to the smaller profiles —
that would change which movements the generator can reach for those profiles.

## 6. File organisation

`exercises.ts` at 159 lines is already dense; at 300 movements it is unmanageable
as one file. Split into `src/core/library/exercises/` with one file per group
(`chest.ts`, `back.ts`, …) plus `index.ts` that concatenates, exports
`EXERCISES`, `BY_ID` and `getExercise`, and keeps the existing import path
working (`@/core/library/exercises`).

## 7. Tests to add (`exercises.test.ts`)

- every movement has ≥ 1 `primaryMuscles`, all valid, no overlap with secondary;
- every `MuscleGroup` has ≥ 10 movements (`carry_grip`, `calves`, `full_body`
  excepted, ≥ 8);
- ≥ 50 movements tagged `functional_bodybuilding`;
- `EXERCISES.length >= 280`;
- every `alternatives` id resolves (existing test — must still pass with the
  split files);
- `EXERCISES.filter(e => e.inGeneratorPool !== false).length === 93` — a
  tripwire so the generator pool cannot grow by accident;
- skill-gate assertion from §3;
- `howTo`, where present, is 2–5 entries and each ≥ 15 chars.

## Acceptance

- [ ] ~300 movements, taxonomy complete, every group populated.
- [ ] All 93 pre-existing movements carry correct muscle data.
- [ ] ≥ 50 FB-tagged movements with real cues and tempos.
- [ ] **`matrix.test.ts` passes unchanged** — the generator pool tripwire proves
      it could not have drifted.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build` clean.

## Do not

- Do not set `inGeneratorPool: true` on anything in this chunk.
- Do not loosen a balance rule or a volume band to make something fit.
- Do not invent a movement to hit a count. A short, honest list beats padding.
