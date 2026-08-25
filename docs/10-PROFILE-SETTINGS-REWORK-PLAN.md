# 10 — PROFILE & SETTINGS REWORK PLAN

**Status:** plan only — not yet executed. **Author:** planning session, 2026-08-25.
**Audience:** the implementing agent. This is a plan, not a diff: read it top to
bottom, then turn §5 into chunks the way `06-REDESIGN-PLAN.md` and
`07-PRODUCTION-REVIEW.md` were turned into chunks.

Reviewed against commit `db6180a` (current `main` / production). `/profile` and
`/profile/settings` are not broken — every control on them works — but they
read as two pages that grew by accretion (onboarding-era fields next to
production-review-era fields next to a device toggle that landed there because
there was nowhere else to put it), not as a page someone designed. This plan
is the "make it make sense" pass the user asked for.

---

## 1. What's actually there today

**`/profile`** — the analysis home (`src/app/profile/page.tsx`):
- Header: display name, three chips (experience, bodyweight, pace %).
- One card with two rows: "Settings" → `/profile/settings`, "Export your
  data" → `/profile/export`.
- `AnalysisTabs`: Strength / Volume / Consistency / Body / Records.

**`/profile/settings`** (`src/app/profile/settings/page.tsx` +
`SettingsForm.tsx`) — six cards, in this order:
1. Appearance (theme) — **saves instantly** via `useColorScheme`.
2. Training days/week — staged, needs the bottom button.
3. Session length — staged, needs the bottom button.
4. Block length — staged, needs the bottom button.
5. Training maxes — **read-only** list, no edit control.
6. Pace — **read-only** sentence, no edit control.
7. `NotificationsCard` — device push toggle, its own instant-apply state
   machine, unrelated to any of the above.

One button at the bottom, "Save and rebuild block", gated on `dirty` (true
only if 2–4 changed) opens a confirm dialog ("this replaces every session
not yet done... training maxes and records are kept") and calls
`updateSettings` + `regenerateProgram`.

**`/profile/export`** — CSV/JSON download. Single-purpose, already good;
out of scope below except as a model to match.

## 2. What's actually wrong with it

Not bugs — every one of these is "works as coded," which is exactly why it
needs a plan rather than a patch.

**(a) Three unrelated interaction models share one page with one button.**
A card can be (i) instant-apply (theme, notifications), (ii) staged behind
the single "Save and rebuild block" action (days/session length/block
length), or (iii) inert — training maxes and pace are display-only. Nothing
on the page marks which is which. A user who taps a training-max row
expecting to correct a number gets nothing; a user who changes only the
theme sees a full-width "Save and rebuild block" button sitting right below
it, disabled, with no visual signal that it has nothing to do with what
they just changed.

**(b) "Settings" is really "regenerate config."** The `/profile` card that
links here describes it accurately — "Training days, session length, block
length, appearance" — which is the tell: this is a generator-parameters
screen wearing a Settings label. Real app/account settings (notifications,
appearance, data export, device) are split across here and a sibling link
one level up on `/profile` (Export), with no stated rule for which goes
where.

**(c) Most of `Profile` is edit-only-via-onboarding.** `displayName`,
`experience`, `equipmentProfile`/`equipment`, `allowAdvanced`, `microPlates`
and `preferredWeekdays` all live on the `Profile` row (`src/server/repo.ts`)
and materially change behaviour — `microPlates` picks the plate set
`SetRow`'s plate-math uses, `equipment`/`experience` change what the
generator and builder can reach, `allowAdvanced` gates skill-gated
movements — but none has a control anywhere except redoing the entire
6-step onboarding wizard (`/onboarding?edit=1`). Bodyweight got pulled out
of this trap already (`BodyweightCard`/`BodyTab`, a real logged time
series with its own table) — the plan below is "do that same move" for the
rest, not invent a new pattern.

**(d) Training maxes are unconditionally read-only.** Correct as the
*primary* path — "these move at the end of a block, based on what your top
sets actually did" is the right default behaviour and should stay the
default. But there is no escape hatch for a wrong number (bad data entry,
returning from a long break and wanting to self-report), which is exactly
the kind of thing that currently sends someone hunting for a database.

**(e) `NotificationsCard` is orphaned.** Reasonable to live in Settings
today for lack of a better home, but it is a device permission toggle, not
a training parameter — it doesn't share a mental model with anything else
on the page and its placement is the clearest sign the page has no
organizing principle.

## 3. What to keep exactly as-is

Called out explicitly so a future pass doesn't "fix" things that aren't
broken:
- `/profile/export` — single-purpose, well-scoped, matches the shape this
  plan wants everything else to have.
- `BodyweightCard` / `BodyTab` — this is the target pattern for turning a
  static onboarding field into a real, logged, editable one. Reuse the
  approach (small inline card with a last-value readout + "Update", a
  history table/chart it feeds) for the other onboarding-only fields in
  §2(c), don't reinvent it.
- The rebuild confirmation dialog's copy (what's kept vs. replaced) — keep
  it, just narrow what triggers it (§4).
- `AnalysisTabs` and its five tabs — out of scope; this plan is about the
  settings/identity half of `/profile`, not the analysis half.

## 4. Target shape

Three pages instead of two cards-in-a-blob, each with one interaction
model, reachable from `/profile` the same way Export is today:

**`/profile`** — unchanged except its settings card becomes three rows
(Settings, Training profile, Export) instead of two.

**`/profile/settings`** — instant-apply only, nothing staged. Appearance
(theme) and `NotificationsCard` live here and only here. No confirm dialog,
no bottom button, because nothing here needs one.

**`/profile/training`** *(new)* — the staged, "this rebuilds your block"
surface: days/week, session length, block length — exactly the three
fields that actually justify the confirm dialog — plus training maxes
(now with a per-lift manual override, each edit logged the same way a
block-end adjustment is, so the audit trail in `training_maxes` stays
intact) and the read-only pace sentence, which belongs here because it's
about how blocks get built, not app-level config. One page, one mental
model — "things that change what your next block looks like" — one button.

**`/profile/identity`** *(new, or fold into `/profile/training` if it turns
out small — decide during chunking)* — display name, experience,
equipment profile, `allowAdvanced`, `microPlates`, preferred weekdays.
Each field editable inline (a `TextField`/`ToggleButtonGroup` per field,
saved on blur/change like `BodyweightCard`, no batch confirm needed since
none of these trigger a rebuild by themselves — changing `microPlates`
just changes future plate-math rounding, changing `equipment` just changes
what's offered next time an exercise is picked). `/onboarding?edit=1`
still exists for the "start over" case but stops being the only way to
fix one field.

Rule of thumb going forward, stated once so it doesn't have to be
re-derived per field: **if changing it should take effect immediately, it's
instant-apply; if changing it should only take effect in the next thing the
app builds (a block, a session), it's staged behind one clearly-labelled
confirm action** — never both concepts on one page with one button, which
is the root cause of §2(a).

## 5. Suggested chunking

Sized the way `06-REDESIGN-PLAN.md`'s chunks were — each independently
shippable, each leaves the app in a working, tested state.

1. **Split Settings into Settings + Training.** Move days/week, session
   length, block length, training maxes (still read-only) and pace into
   `/profile/training`; leave Appearance + `NotificationsCard` in
   `/profile/settings`. Update the `/profile` card and the
   `06-REDESIGN-PLAN.md` §5 redirect table. No new fields yet — this chunk
   is purely the reorganization from §2(a)/(b), and should be low-risk
   since it's moving existing, working cards.
2. **Training-max manual override.** Add an edit control per lift on
   `/profile/training`, a server action that writes a new `training_maxes`
   row the same way block-end evaluation does (so history/audit trail
   stays consistent — never mutate a row in place), and a short "why would
   I do this" line in the UI so it doesn't read as undermining the
   automatic system.
3. **Identity fields, one at a time, in `BodyweightCard`'s pattern.** Start
   with `displayName` (lowest risk, purely cosmetic) to prove the pattern,
   then `microPlates` and `experience`/`equipment`/`allowAdvanced` together
   (they're the ones that change generator/builder behaviour, so bundle
   the testing). `preferredWeekdays` last — it's the most onboarding-wizard-shaped
   of the set (a 7-toggle picker) and lowest value on its own.
4. **Retire the onboarding-wizard-as-editor path**, or at least stop
   surfacing `/onboarding?edit=1` as the primary "change my profile" link
   once chunk 3 covers everything it used to be needed for — keep the
   wizard itself for first-run onboarding, just stop pointing existing
   users at it for single-field edits.

Each chunk should ship with the same discipline as `07-PRODUCTION-REVIEW.md`:
a short "why," a test where the field has server-side validation, and a
`pnpm lint && pnpm typecheck && pnpm test` pass before merging.
