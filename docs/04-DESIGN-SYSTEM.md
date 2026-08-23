# 04 — DESIGN SYSTEM (Material Design 3, deliberately plain)

Design goal: a gym app you can read at arm's length, operate with one sweaty
thumb, and never have to think about. Material 3 out of the box. No bespoke
components where an M3 one exists.

---

## 1. Colour — M3 tokens

Source colour: **`#1E5F4B`** (deep green — calm, not a "hustle" red).
Generate a full M3 tonal palette from it and expose the standard role tokens.

| Role | Use |
|---|---|
| `primary` / `onPrimary` | main actions: Start session, Log set |
| `primaryContainer` | today's session card |
| `secondary` | supporting chips (tempo, rest, RPE) |
| `tertiary` | accents on PR / achievement |
| `error` | missed reps, pain flag |
| `surface`, `surfaceContainerLow/High` | cards, sheets, app bars |
| `outlineVariant` | dividers |

Both **light and dark** schemes ship in v1. Dark is the default in the session
player (gyms are dark, phones are bright).

Semantic aliases layered on top (defined once in `src/theme/tokens.ts`):
```
tierMain     = primary            // T1, the big lift
tierSecondary= secondary
tierAccessory= tertiary
readinessGood/ok/low = M3 green/amber/red containers
```

## 2. Typography

Material 3 type scale, single family: **Roboto Flex** (or Roboto). Overrides:
- `displaySmall` for the current weight in the player (must read from 1 m away)
- `headlineSmall` for exercise names
- `labelLarge` for slot letters (A, B, D1)
- Set numbers use **tabular figures** (`font-variant-numeric: tabular-nums`)
  so numbers don't jitter as they change.

## 3. Shape & elevation

M3 defaults: cards `medium` (12 dp), FAB/dialogs `large` (16 dp), chips `full`.
Elevation level 0–1 only; use `surfaceContainer*` tones instead of shadows.

## 4. Components (MUI ↔ M3 mapping)

| Need | Component |
|---|---|
| Navigation | `BottomNavigation` (4 items: Plan · Session · History · Settings), `NavigationRail` ≥ 900 px |
| Session card | `Card` + `CardActionArea` |
| Primary action | `Button variant="contained"`, full-width, min height **56 px** |
| Set logging | custom `SetRow` built from `TextField` + `ToggleButtonGroup` |
| Rest timer | `CircularProgress determinate` + `displaySmall` countdown |
| Readiness | three `Slider`s in a `Dialog` |
| Metadata | `Chip` (tempo `30X1`, rest `90s`, RPE `@8`) |
| Substitution | `Menu` on the exercise row → "Swap exercise" |
| Feedback | `Snackbar` (never `alert`) |
| Loading | `Skeleton` matching final layout, never a spinner on a full page |

## 5. Screens

### 5.1 Onboarding wizard (6 steps, one question per screen)
1. **How many days a week can you train?** — big 2/3/4/5/6 selector. Each option
   shows what it becomes ("3 days — full-body, one heavy lift each day").
2. **How long have you been lifting?** — beginner / intermediate / advanced.
3. **What do you have?** — equipment profile cards + toggles (bar, rack, bench, bike, bands, sled).
4. **How strong are you right now?** — for squat, hinge, press, pull: either a
   known 1RM or "weight × reps I could do comfortably". Skippable → the app
   uses week 1 to calibrate at conservative loads.
5. **How long can a session be?** — 45 / 60 / 75 min, default 60.
6. **Block length** — 4 weeks (default) or 6 weeks. Then **Build my plan**.

Progress indicator on top, Back always available, answers persisted per step so
a refresh doesn't lose them.

### 5.2 `/plan`
- App bar: block name + week pill ("Week 2 of 4").
- **Today card** first, in `primaryContainer`: title, ≈ duration, the main lift
  and its top set ("Back Squat 4×5 @ 92.5 kg"), big **Start** button.
- Then the rest of the week as compact rows: day, title, duration, status icon.
- A 4-or-6 column week strip at the top for jumping between weeks.
- Deload weeks are visually marked ("Deload — take it easy, that's the point").

### 5.3 `/session/[id]` — the session player (the most important screen)
- **Readiness dialog** on first open (3 sliders + Skip).
- Header: elapsed time, session title, "≈ 52 min planned", overflow menu.
- **Block accordion**: only the current block expanded. Each block shows its
  letter, name and estimated minutes.
- **Exercise card**: slot letter, name, tempo chip, cue line, "Swap" menu.
- **Set rows**: `3 × 5 @ 92.5 kg`. Tapping a row opens an inline editor with
  ±2.5 kg steppers, a rep stepper, and an RPE `ToggleButtonGroup` (6–10).
  Tick to complete. Completed rows collapse to one line with a check.
- **Rest timer** auto-starts on completion: a bottom sheet with a big countdown,
  −15 s / +15 s / Skip. Vibrate on zero if supported.
- Bottom bar: "Next block" / "Finish session".
- Wake lock on while the player is open.
- Offline chip when the outbox is non-empty.

### 5.4 `/history`
- Segmented control: **Sessions** · **Lifts** · **PRs**.
- Sessions: reverse-chronological list, duration, readiness dot, completion %.
- Lifts: pick an exercise → estimated-1RM line chart + best sets table.
- PRs: list with dates. One chart library, one chart type. No dashboards.

### 5.5 `/settings`
Days per week, session cap, equipment, units, block length, "Regenerate plan"
(with a clear warning that unlogged future sessions are replaced), sign out,
export data as JSON.

## 6. Interaction rules

- Tap targets ≥ 48 dp everywhere; the log-set tick is ≥ 56 dp.
- No horizontal scrolling anywhere, ever.
- Every destructive action confirms in a `Dialog` naming exactly what is lost.
- Motion: M3 standard easing, 200–300 ms. `prefers-reduced-motion` respected.
- Empty states always say what to do next, never just "No data".
- All copy is plain and calm. Coaching cues, not hype. No exclamation marks
  except the readiness green light.

## 7. Accessibility (non-negotiable)

- Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI edges — verified on both schemes.
- Every icon button has an `aria-label`.
- The player is fully keyboard-operable; focus visible; focus moves to the rest
  timer when it opens and returns to the next set when it closes.
- Set completion announces via `aria-live="polite"`.
- Never encode meaning in colour alone: readiness shows a dot **and** a word.
