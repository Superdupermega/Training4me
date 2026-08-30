# Chunk 22 — The player, felt

**Depends on:** all. **Size:** L. **Read first:** `docs/10-FEEL-AND-POLISH.md`
§3 (the rules) and §4 (what not to do).

Three changes to the screen you spend every session inside. They are ordered
by dependency: the type scale is used by focus mode, which is where the
completion feedback lands.

Findings closed: #1, #2, #3.

---

## 1. A display type scale

**Problem.** The largest token in `src/theme/theme.ts` is `h1` at 1.75rem.
The running session clock renders at `variant="h3"` (1.125rem), the weight
input at a hardcoded `1.4rem`. `docs/04-DESIGN-SYSTEM.md` §2 already
specified a display size for the current weight — "must read from 1 m away"
— and it was never built.

**Do.** Add three variants to `theme.typography`:

```ts
displayLarge:  { fontSize: '3rem',    fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05 },
displayMedium: { fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 },
displaySmall:  { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 },
```

MUI does not know these names. You must **both** declare them in
`createTheme`'s `typography` **and** augment the module types, exactly the
way the palette extension at the top of `theme.ts` already does for
`primaryContainer` — a `TypographyVariants` / `TypographyVariantsOptions`
interface augmentation, plus a `TypographyPropsVariantOverrides` augmentation
so `<Typography variant="displayLarge">` typechecks. Follow that file's
existing pattern; do not invent a second one.

Apply them:

| Where | File | Now | Becomes |
|---|---|---|---|
| Rest countdown | `RestTimer.tsx` | `h2` | `displayLarge`, `.tnum` |
| Weight field | `SetRow.tsx` `Stepper` | `fontSize: '1.4rem'` | `displaySmall` via `typography` sx, keep `.tnum` |
| Session clock | `SessionPlayer.tsx` `TopBar` action | `h3` | `displaySmall`, `.tnum` |
| Focus-mode set target | new, §2 | — | `displayLarge` |
| e1RM headline | `StrengthTab.tsx` | — | `displayMedium` |

Every one of these is a number that changes. **All of them keep `.tnum`** or
they will jitter.

**Watch:** the clock in `TopBar` sits in a fixed-height app bar. Check
`displaySmall` does not push its height and shift the content below it —
`TopBar` is `position: sticky`, so an overflow shows as a jump on scroll,
not a clipped glyph.

## 2. Focus mode

**Problem.** `SessionPlayer.tsx` renders all six blocks as an accordion
column with the main lift pre-expanded. Mid-set you want this exercise, this
set, the weight and the clock. You get a scroll list of ~20 collapsed rows
with the one you care about somewhere in it.

**Do.** Add a second presentation over the *same state*. This is a rendering
change — do not touch `complete()`, `carriedFromLogged()`, the outbox, the
autoregulation branch, or any server action.

- New component `src/components/session/FocusView.tsx`. Props: the current
  block, the current `BlockExercise`, the ordered sets for it, the same
  `logged` / `carried` / `contexts` / `increment` / `microPlates` values
  `SessionPlayer` already holds, and the same `onComplete` callback.
- `SessionPlayer` owns a `view` state (`'focus' | 'list'`) and a cursor —
  `{ blockLetter, slot }` — for which movement is showing. Default to
  `'focus'` once `session.status === 'in_progress'`; the readiness dialog
  still runs first, unchanged.
- The cursor advances to the next movement when every non-`ramp` set of the
  current one is logged. It must **not** auto-advance past a movement with
  unlogged sets — a skipped set is a decision, not a reason to jump.
- Seed the cursor on mount from what is already logged, so reloading
  mid-session resumes where you were rather than at block A. Reuse the same
  "later sets win" walk `carriedFromLogged()` does.
- Navigation: back/forward controls for previous/next movement, always
  available (you must be able to go back and fix set 2), plus a toggle to
  the list view. The list view is the existing accordion, unchanged, and
  remains how you see the whole session.
- Layout, top to bottom: block letter + slot + exercise name, the cue, the
  `ExerciseContextLine` (unchanged), the set list for **this movement only**
  rendered with the existing `SetRow`, and the position in the session
  ("Movement 3 of 9").

**Reuse `SetRow` verbatim.** Do not fork it. Every behaviour that took
several rounds to get right lives in it — the carried-weight effect that
only fills an untouched field, the quick-✓ that refuses to log a weight
nobody typed, the `minWidth: 0` that keeps the stepper on screen, the
timed-set weight field gated on `Exercise.loadable`. A fork will lose at
least one of these.

**Budget.** `/session/[id]` is capped at 170 kB and is the tightest route in
the app. If adding `FocusView` blows it, `next/dynamic` the *list* view
(`ssr: false` is safe — it is never the first paint in focus mode), the same
way `ReadinessDialog` and `RestTimer` already are. Report the number either
way in `PROGRESS.md`.

**Keyboard and screen reader.** Moving between movements must be reachable
without a pointer, and the existing `aria-live` set counter in
`SessionPlayer` must keep announcing — do not leave it behind in the list
view only.

## 3. Set-completion feedback

**Problem.** `SetRow`'s logged state is `bgcolor: 'action.hover'` plus a
small `CheckIcon`. Nothing else happens.

**Do.** Four things, all inside `SetRow` and `SessionPlayer`:

1. **Haptic.** `navigator.vibrate?.(15)` in `SetRow`'s `submit()`. Optional
   chaining is required — iOS Safari does not implement it and this must not
   throw. A single short pulse; the rest timer's `[120, 60, 120]` is the
   "your rest is over" signal and these two must stay distinguishable.
2. **Row flash.** On transition to logged, the row briefly takes
   `primaryContainer.main` and settles to its resting `action.hover` over
   ~400ms. Drive it from a CSS animation on a class, not a `setTimeout` that
   sets state — a timer will fight React's own re-render on the next set.
   `Providers.tsx` flattens it under reduced motion automatically.
3. **The tick draws itself.** Replace the instant `CheckIcon` on the
   *newly* logged row with an inline SVG check whose `stroke-dasharray` /
   `stroke-dashoffset` animates to 0 over ~250ms. Rows already logged when
   the component mounted must render finished, not replay — a reload
   mid-session should not animate twelve ticks at once. Gate on "did this
   row transition during this mount", not on `Boolean(logged)`.
4. **Session progress bar.** A `LinearProgress` under `TopBar` in
   `SessionPlayer`, value `totals.done / totals.total * 100`. `totals`
   already exists and already excludes ramp sets — use it as-is, do not
   recount. The `4/12 sets` chip stays; the bar gives the number a shape.

**Do not** animate the plate breakdown, the RPE toggle group, or the
accordion. The point is that logging a set is the one moment that responds.

## 4. Tests

Extend, do not replace, `src/components/session/SetRow.test.tsx` and
`SessionPlayer.test.tsx`.

- Focus mode renders only the current movement's sets.
- The cursor advances when the last non-ramp set of a movement is logged,
  and does **not** advance while one is unlogged.
- The cursor seeds correctly from `initialLogged` on mount.
- Going back to a previous movement and editing a logged set still routes
  through the same `onComplete` (assert `logSets` is called with the same
  row shape as the list view produces).
- `navigator.vibrate` being `undefined` does not throw on submit.
- The list view still renders every block, unchanged.

Assertions about animation itself are not worth writing — assert the class
or attribute is applied, not that a frame rendered.

## Acceptance

- [ ] `displayLarge/Medium/Small` exist, typecheck as `variant` values, and
      are applied at all five sites in §1.
- [ ] Focus mode is the default view of an in-progress session; the list
      view is one tap away and unchanged.
- [ ] Cursor resumes correctly after a mid-session reload.
- [ ] Logging a set: vibrates where supported, flashes, draws its tick, and
      moves the progress bar.
- [ ] A reload mid-session does not replay tick animations.
- [ ] `SetRow` is not forked.
- [ ] `/session/[id]` first-load JS reported in `PROGRESS.md`, and either
      under 170 kB or the overage explained.
- [ ] Keyboard-only pass through a full session succeeds.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.
