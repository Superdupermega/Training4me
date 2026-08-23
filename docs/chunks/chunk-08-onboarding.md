# Chunk 08 — Onboarding wizard

**Read first:** `docs/00-CONTEXT.md`, then `docs/04-DESIGN-SYSTEM.md §5.1` and §4.
**Depends on:** 07. **Size:** M.

## Mission
Six questions, one screen each, ending in a real generated program in the
database. This is where the user's single most important input — days per week —
enters the system.

## Deliverables

1. **`src/app/(app)/onboarding/`** — a client wizard, one step per screen,
   current step in the URL (`?step=3`) so Back/refresh work:
   - **Step 1 — Days per week.** Five large selectable cards (2–6). Each shows
     `describeSkeleton(n)` from `src/core/generator/split.ts` plus the archetype
     names, so the choice is meaningful and not a bare number.
   - **Step 2 — Experience.** beginner / intermediate / advanced, each with a
     one-line definition (years lifting, not ego).
   - **Step 3 — Equipment.** Five profile cards, then toggles for pull-up bar,
     rack, bench, bike/rower, bands, sled, dip station, trap bar. Selecting a
     profile pre-sets sensible toggles; toggles remain editable.
   - **Step 4 — Strength.** For squat / hinge / press / pull: a segmented choice
     of "I know my 1RM" (single field) or "weight × reps I can do comfortably"
     (two fields, uses Epley) or "skip". Show the derived training max live as
     the user types. Skipping uses `defaultTrainingMaxes`.
   - **Step 5 — Session length.** 45 / 60 / 75 min, default 60, with the note
     "we'll build every session to fit".
   - **Step 6 — Block length.** 4 weeks (recommended) or 6 weeks, with a
     one-line explanation of the difference. Primary button: **Build my plan**.
2. **State** — a single `useReducer` in `onboarding/state.ts`, persisted to
   `sessionStorage` on change (try/catch), validated per step with the Zod
   schemas from `src/core/types.ts`. Next is disabled until the step is valid,
   with the reason shown inline, never as a silent disabled button.
3. **Submission** — `saveProfile` then `generateFirstProgram`; a full-screen
   determinate-looking progress state ("Building your 4-week block…"), then
   `router.replace('/plan')`. Failure shows the error and keeps the answers.
4. **Guard** — visiting `/onboarding` with a completed profile redirects to
   `/plan` unless `?edit=1`.
5. **Tests** — component tests with Testing Library:
   - step validation blocks Next on empty required fields
   - Epley preview updates as the user types (100 kg × 5 → TM 79.9→ rounded 77.5)
   - choosing a bodyweight-only profile hides barbell strength inputs in step 4
   - the reducer produces a `GeneratorInput`-compatible payload (snapshot)

## Acceptance criteria
- [ ] A new user can go from sign-in to a stored, generated program without touching a keyboard shortcut or the console.
- [ ] Refreshing mid-wizard keeps the answers.
- [ ] Every step is reachable by keyboard; focus moves to the step heading on change.
- [ ] Four green commands.

## Do NOT
- Do not build the plan or session screens (chunks 09/10).
- Do not call the generator from the client — it runs in the server action.
- Do not add a seventh question. Six is the product.

## Commit
`feat(ui): add six-step onboarding wizard that generates the first program`
