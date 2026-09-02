# Chunk 13 — Backlog (optional, pick individually)

**Read first:** `docs/00-CONTEXT.md` and the relevant methodology section.
**Depends on:** 12. **Size:** S each — run one item per session, not all at once.

Only build these after you've trained a full block with the app. Real annoyance
beats speculation.

1. **Data export/import** — download everything as JSON; re-import into a fresh
   account. Cheap insurance, high value.
2. **Session reminders** — Web Push on training days at a chosen time.
   Needs a `push_subscriptions` table and a Vercel cron route handler.
3. **Manual deload / skip week** — "I'm travelling" → shift the block forward,
   or force a deload now and re-wave the remaining weeks.
4. **Alternate block templates** — a strength-biased block (more T1 sets, fewer
   T3) and a "move well" block (Filly-heavier: two T2, more unilateral, more Z2).
   Implemented as a `blockTemplate` field in `GeneratorInput`, not a fork of the
   generator. **Must still pass the matrix test.**
5. **1RM test week** — an optional week 5 that replaces the wave with a
   ramp-to-a-top-single, and feeds the result straight into the next TM.
6. **Warm-up customisation** — let the athlete pin a mobility drill that appears
   in every primer.
7. **Bodyweight & measurements** — a weekly weigh-in, plotted against tonnage.
   Keep it neutral; no targets, no judgement.
8. **Swedish localisation** — the exercise `aliases` field already carries the
   Swedish names; add `next-intl` and translate the UI strings.
9. **Apple Health / Google Fit export** — write completed sessions as workouts.
10. **Plate calculator** — given a target load and available plates, show what to
    load per side. Small feature, disproportionately loved.

**Superseded in part.** Chunks 14–21 (the v2 redesign, see
`docs/06-REDESIGN-PLAN.md`) take priority over this list. Item 7 is absorbed
into chunk 20 (Profile → Body). Items 1, 2, 3, 4, 5, 6, 8, 9 and 10 remain open
backlog and should be picked up only after chunk 21.

For each: write a short chunk file first (mission, deliverables, acceptance,
do-not), then run it. Keep the discipline — that's what made the first twelve work.

**Status as of the v3 plan (2026-09-02).** Done in earlier chunks: 1 (export,
#16), 2 (reminders, #24 — code complete, secrets pending), 7 (bodyweight,
#19), 10 (plate math, #17). Taken by chunk 26 of `11-COACH-PLATFORM.md`: 3
(skip/shift week, forced deload) and 5 (1RM test week). Still open and still
valid: 4 (alternate block templates), 6 (warm-up pinning), 8 (Swedish UI),
9 (Apple Health / Google Fit). None of those is part of v3 — see
`11-COACH-PLATFORM.md` §7.
