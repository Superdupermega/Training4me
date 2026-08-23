# Chunk 09 — Plan views

**Read first:** `docs/00-CONTEXT.md`, then `docs/04-DESIGN-SYSTEM.md §5.2` and §4.
**Depends on:** 07, 08. **Size:** M.

## Mission
Show the athlete their block: what today is, what the week is, where they are
in the mesocycle.

## Deliverables

1. **`src/app/(app)/plan/page.tsx`** (server component)
   - App bar: block name + "Week 2 of 4" pill.
   - **Week strip**: 4 or 6 segments, current week filled, completed weeks
     ticked, deload week marked. Tapping navigates to `/plan/week/[n]`.
   - **Today card** in `primaryContainer`: session title, `≈ 52 min`, the main
     lift and its top working set rendered from real data
     ("Back Squat · 4 × 5 @ 92.5 kg"), and a full-width **Start session** button.
     If today has no session: "Rest day — next session Thursday" with the
     option to train anyway (opens the next planned session).
   - **This week** list below: day, weekday, title, duration, status icon
     (planned / done / skipped), main lift name. Rows are `CardActionArea`s.
2. **`src/app/(app)/plan/week/[n]/page.tsx`** — the full week, each session
   expandable to show all blocks and prescribed sets read-only, with tempo and
   rest chips. This is the "what am I doing on Thursday" screen.
3. **`src/components/plan/`** — `WeekStrip`, `TodayCard`, `SessionRow`,
   `BlockPreview`, `DurationChip`, `StatusIcon`. Presentational, prop-driven,
   no data fetching inside them.
4. **Empty / edge states**
   - No active program → a card explaining why plus "Build a plan" → `/onboarding`.
   - Program finished (all sessions done) → an end-of-block card summarising
     completion % and a **Start next block** button (wired in chunk 11; here it
     can link to a stub that says so).
   - Deload week banner: "Deload week — lighter on purpose. Don't add weight."
5. **Loading** — `loading.tsx` with `Skeleton`s matching the final layout.
6. **Tests** — render tests with fixture data: today card picks *today's* session
   (test around a fixed clock, including a Sunday and a rest day), week strip
   marks the right week, deload banner appears only in deload weeks.

## Acceptance criteria
- [ ] `/plan` renders a real generated program from the database.
- [ ] The main lift and its load shown on the today card match the stored `prescribed_sets`.
- [ ] Lighthouse a11y ≥ 95 on `/plan`.
- [ ] No layout shift between skeleton and loaded content.
- [ ] Four green commands.

## Do NOT
- Do not implement logging, timers, or the player (chunk 10).
- Do not fetch data inside presentational components.

## Commit
`feat(ui): add plan overview and week detail views`
