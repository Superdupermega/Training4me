# Chunk 24 — Craft

**Depends on:** chunk 22 (type scale, motion vocabulary). **Size:** M–L.
**Read first:** `docs/10-FEEL-AND-POLISH.md` §3 and §4.

Eight independent items with **no ordering between them**. Split across
sessions freely, or cherry-pick — nothing here blocks anything else here.
Ship each one green rather than batching them.

Findings closed: #9, #10, #11, #12, #13, #14, #15, #16.

---

## 1. The rest timer, properly (finding #9)

`RestTimer.tsx` is a bottom sheet with a `CircularProgress`. Three additions:

- **Next-set preview inside it.** "Up next: Set 3 · 5 reps @ 100 kg". The
  prescription is right there in the block `SessionPlayer` already holds —
  pass it down. This is what turns the rest sheet from a countdown into part
  of the session.
- **Optional full-screen.** Tap the timer to expand it: countdown at chunk
  22's `displayLarge`, background dimmed, the next-set line under it. Tap
  again or log the next set to collapse. Do not make this the default — the
  set list must stay reachable during rest.
- **A notification when you leave the app.** *Read the caveat below before
  building this.*

**The caveat, and it is the whole item.** `public/sw.js` already has `push`
and `notificationclick` handlers and the app already asks for notification
permission in `NotificationsCard.tsx`, so a local
`registration.showNotification()` needs no new infrastructure. What is
*not* solved is **firing it on time while backgrounded**: a hidden tab's
timers are clamped hard (roughly one minute in Chrome), which is longer than
most rest periods, and iOS standalone PWAs are worse. The existing
`setTimeout` against an absolute `endsAt` in `RestTimer.tsx` is already the
right shape — it just cannot be trusted to run while hidden.

So: implement it as **best-effort**, and additionally `postMessage` the
`endsAt` to the service worker so it can fire the notification if it is
alive. Then **test it for real** — background the app on a phone with a 90s
rest and see what actually happens — and write what you observed into
`docs/DECISIONS.md`. Do not claim in a comment or the README that rest
notifications work reliably if they do not. A documented limitation is a
result; an untested promise is a defect.

**Do not** rebuild this on the cron/web-push path in `src/server/push.ts`.
That exists for scheduled training reminders and routing a 90-second rest
through a server round trip is the wrong mechanism.

## 2. Block identity (finding #10)

Primer, main lift, secondary, superset, finisher and down-regulate all render
as the same accordion with the same overline in `SessionPlayer.tsx`.

Give each `block.kind` an icon and an accent. `block.kind` is a closed union
in `src/core/types.ts` — key a `Record<BlockKind, {icon, color}>` off it so a
new kind is a typecheck failure. Draw accents from roles that already exist
(`primary` for main, `secondary`, `tertiary`, the surface tones); **do not add
palette entries** for this. The main lift should be visibly the main lift at a
glance without reading a word.

Apply it in both the accordion (list view) and chunk 22's focus view.

## 3. Plate visualisation (finding #11)

`plateBreakdown()` in `src/core/plates.ts` already returns structured
per-side plate data; `SetRow.tsx` renders it as the string "20 + 10 + 2.5 per
side".

Draw it: a short bar with stacked rectangles per side, each plate's width and
colour by denomination. Standard IWF-ish colours (25 red, 20 blue, 15 yellow,
10 green, 5 white, 2.5 red) are the convention people read without a legend.

- Any **layout** maths (relative widths, ordering) goes in `src/core` next to
  `plateBreakdown` and gets a unit test — it is pure and belongs there.
- Keep the text line as well, or as the `aria-label`. The drawing is faster
  to read under a bar; the text is what a screen reader gets.
- Only renders when `barbell && weight > STANDARD_BAR_KG`, exactly as the
  existing plate line does. Respect `microPlates` via `availablePlatesKg()`.
- Handle `!plates.exact` — the closest-loadable case already has copy
  ("closest at 97.5 kg"); the drawing must not silently imply an exact load.

## 4. Empty states (finding #12)

`EmptyChart.tsx`, `src/app/offline/page.tsx` and `src/app/not-found.tsx` are
bare text.

One muted inline SVG glyph each, `text.secondary` at low opacity, sized ~64px,
above the existing copy. **Do not change the copy** — it is good and it is
specific ("Nothing logged yet — log a few sessions and a trend appears here").
Keep the glyphs abstract: a line, a bar, a plate. No characters, no mascots.
`aria-hidden` on all of them; the message is the accessible content.

## 5. Exercise pattern glyphs (finding #13)

286 exercises, no visuals anywhere, including the picker dialog and
`/exercises`.

Add a glyph per **movement pattern** (`Exercise.pattern` — a closed union in
`src/core/types.ts`), not per exercise. Roughly ten simple shapes, keyed off
the union so a new pattern fails the typecheck. Show them in
`ExerciseBrowser.tsx`, `ExercisePickerDialog.tsx` and the exercise detail
page.

**Explicitly not licensed video or photography** — see
`docs/10-FEEL-AND-POLISH.md` §4. The goal is breaking up walls of text and
making the browser scannable, not demonstrating form.

`/exercises` is capped at 160 kB. Inline SVG components for ten shapes are
negligible, but check the number rather than assuming it.

## 6. Streak on Today (finding #14)

`consistency()` exists in `src/server/analytics.ts` and surfaces only on a
profile tab. The number that makes you train should be on the screen you
open.

Add it to `src/app/today/page.tsx` — sessions this week vs. planned, and the
current streak. It is an `unstable_cache`'d call already; adding it to
`/today`'s existing `Promise.all` costs nothing.

`/today` is capped at 130 kB and is the app's front door. This should be
server-rendered text, no new client component.

## 7. Warm-up ladder (finding #15)

Ramp sets exist in the data (`PrescribedSet.kind === 'ramp'`) and render as
faded rows labelled "Ramp" in `SetRow.tsx`.

Present them as what they are: a ladder to the working weight — "empty bar →
60 → 80 → 92.5, then work". Group the ramp sets of a movement into one visual
unit above its working sets, showing the progression as a sequence rather
than as three rows that look like undifferentiated sets.

**Do not change how ramp sets are counted.** `totals` in `SessionPlayer` and
the per-block `blockDone` calculation both filter `s.kind !== 'ramp'`, and
`docs/07-PRODUCTION-REVIEW.md` #14 is exactly the bug where those two
disagreed. This is presentation only.

## 8. Heatmap cells (finding #16)

`Heatmap.tsx` draws 12px cells — below a comfortable touch target and not
interactive.

Raise the cells (16–20px), and make each one reveal its date and set count on
tap or focus. The component currently ships zero client JS and each cell
already carries an `aria-label`; prefer a CSS `:hover`/`:focus-within` reveal
over making it a client component. If it must become client-side, report the
`/profile` bundle delta.

Check the wider grid still fits: the container is `overflowX: 'auto'`, so it
will scroll rather than break — confirm it scrolls inside its own box and does
not make the page scroll horizontally.

---

## Tests

Most of this is presentational. Test the parts that are not:

- Plate layout maths in `src/core` — direct unit tests, including the
  inexact-load case and `microPlates`.
- The `BlockKind` and `pattern` glyph maps: a test that iterates the union
  and fails on a missing key.
- Ramp grouping: assert `totals` and `blockDone` are unchanged by the new
  presentation — a regression test against finding #14's bug.
- `/today` still renders when `consistency()` returns an empty history.

## Acceptance

- [ ] Rest timer shows the next set, expands full-screen, and attempts a
      notification — with its **observed** backgrounded behaviour written
      into `docs/DECISIONS.md`.
- [ ] Each block kind is visually distinct in both the list and focus views,
      keyed off the union.
- [ ] Plates draw under the bar, with the text line kept for screen readers,
      and the layout maths unit-tested in `src/core`.
- [ ] Empty states have glyphs; copy unchanged.
- [ ] Pattern glyphs appear in the browser, picker and detail page.
- [ ] `/today` shows the streak, server-rendered.
- [ ] Ramp sets read as a ladder; `totals` and `blockDone` provably unchanged.
- [ ] Heatmap cells are ≥ 16px and inspectable; the page does not scroll
      horizontally.
- [ ] No route exceeds its budget; any overage reported, not edited.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm verify:actions` clean.
