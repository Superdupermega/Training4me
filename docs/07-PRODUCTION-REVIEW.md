# Production review — training4me.vercel.app

Reviewed 2026-08-25 against commit `42f4e50`, which is what `main` and the live
production deployment (`dpl_FQKdaTUYefeLPX2LfhxGBk2aod2K`) both point at.

**Baseline is healthy.** 242 tests pass, `pnpm lint` and `pnpm typecheck` are
clean, `pnpm build` succeeds, all 11 `t4m_` tables have RLS enabled, the app is
live, and the PIN gate is serving (`/` → `/unlock`, HTTP 200). Nothing here is
"the app is broken." What follows is what stands between this and something you
would trust with three years of training data.

Items are ordered by what they cost you if left alone. Each one says where it
is, why it matters, and how to know it is fixed.

---

## P0 — Fix before the next session you log

### 1. The PIN gate is bypassable. Every server action is reachable without it.

**Confirmed**, not theoretical. From this commit's own build output
(`.next/server/server-reference-manifest.json`), all 20 server action IDs list
`app/unlock/page` among their allowed workers:

```
6045417eb991ff7d46e55d1a335631a19e8c74d8a4  ['app/unlock/page', 'app/today/page', ...]
```

Why: `src/app/unlock/page.tsx:9` imports `unlock` from `src/server/actions.ts`.
Next.js registers **every** export of a `'use server'` module as callable from
**every** route that imports **any** of them. So `/unlock` can invoke
`regenerateProgram`, `updateSettings`, `logSets`, `finishSession`,
`skipSession`, `archiveRoutine`, `saveRoutineDays` — the entire mutation
surface.

And `src/middleware.ts:57` deliberately excludes `/unlock` from the matcher:

```
'/((?!_next/|unlock|offline|sw\\.js|favicon.ico|manifest.webmanifest|icon.*|.*\\.svg$).*)'
```

The one route left unguarded is the one route that can reach everything. A
`POST /unlock` with a `Next-Action: <id>` header and no cookie executes the
action. Your program can be wiped, your settings rewritten, junk sets logged.

I did not fire a live mutation to prove it — the session's egress policy blocks
the host, and I would not run destructive calls against your real data anyway.
You can verify it yourself safely with the read-only one:

```bash
curl -i -X POST https://training4me.vercel.app/unlock \
  -H 'Next-Action: 6045417eb991ff7d46e55d1a335631a19e8c74d8a4' \
  -H 'Content-Type: text/plain;charset=UTF-8' \
  --data '[[],{}]'
```

A `200` with an RSC payload instead of a redirect to `/unlock` is the bypass.

**Fix — do all three, they are independent layers:**

1. **Move `unlock` into its own module** (`src/server/unlockAction.ts`) so
   `/unlock` no longer imports `actions.ts` at all. This alone removes
   `app/unlock/page` from the other 19 actions' worker lists.
2. **Authorize inside every action.** Next.js's own guidance is that server
   actions are public HTTP endpoints. Add a single guard and call it first in
   every action in `actions.ts`:
   ```ts
   async function requireUnlocked() {
     const pin = process.env.APP_PIN;
     if (!pin) return;                       // local dev, no lock
     const c = (await cookies()).get(COOKIE_NAME)?.value ?? '';
     if (!safeEqual(c, await deriveToken(pin))) throw new Error('Locked');
   }
   ```
   Middleware is a convenience, never the authorization boundary.
3. **Stop excluding `/unlock` wholesale.** Gate it by method: let `GET` through,
   run the cookie check on `POST`.

**Verify:** re-run the curl above and get a redirect or a 403. Add a test that
asserts no action ID except `unlock`'s lists `app/unlock/page` in the manifest —
that keeps the regression from coming back silently.

### 2. Anyone can read and write the whole training log directly, no app involved

`src/server/db.ts:23` hardcodes the publishable key. The repo is **public**, so
the key and the project URL (`db.ts:8`) are not merely "visible in a network
tab" — they are in a README-linked file anyone can read. And every `t4m_` policy
is wide open to `anon`:

```
t4m_profile      ALL  USING (true)  WITH CHECK (true)   roles: {authenticated, anon}
t4m_session      ALL  USING (true)  WITH CHECK (true)   roles: {authenticated, anon}
t4m_logged_set   ALL  USING (true)  WITH CHECK (true)   roles: {authenticated, anon}
... all 11 tables identical
```

That is full `SELECT`/`INSERT`/`UPDATE`/`DELETE` on your entire history for
anyone who reads `db.ts`. The README frames this as a considered trade-off, and
as written it is honest — but it was reasoned about as "the key is public
anyway," not as "the key is published in a public repo next to the project
URL." Those are different risks.

**Fix:** the README already documents it — set `SUPABASE_SECRET_KEY` in Vercel
and redeploy; `resolveKey()` picks it up with no code change. Then tighten the
policies to `TO service_role` (or drop the `anon` grant) so the publishable key
stops working even if someone still has it. Do the env var first, confirm the
app still works, then tighten the policies.

**Verify:** after both, `curl` the REST endpoint with the publishable key and
get `[]` or a permission error:
```bash
curl 'https://evlxbewvsgrlncvtagmf.supabase.co/rest/v1/t4m_profile?select=*' \
  -H 'apikey: sb_publishable_vpwx3wRY7j-5xsIe0-jjyA_olXG2fl9'
```

### 3. The unlock throttle does not throttle

`src/server/actions.ts:31` sleeps 400 ms on a wrong PIN. That is a *serial*
delay — it does nothing against an attacker sending 500 requests in parallel,
which is the only way anyone would actually attack it. There is no counter, no
lockout, no IP tracking. The README's "wrong guesses are slowed down" oversells
what this does.

**Fix:** a real limiter keyed on IP. The Supabase project already has a
`rate_limits` table (currently RLS-enabled with no policies — see the advisor
output). Lock out after N failures in a window, and return the same generic
error either way. Then correct the README sentence.

### 4. The PIN field asks for a PIN when the docs beg you for a passphrase

`src/app/unlock/page.tsx:39` sets `inputMode: 'numeric'`, so a phone shows a
number pad. The README says twice, emphatically, "Make it a passphrase, not four
digits… this is genuinely the only thing between the internet and your log," and
suggests `bench-105-in-may` — which is painful to type on a numeric keypad. The
UI is actively steering you toward the weak choice the docs warn against.

**Fix:** drop `inputMode`, relabel to "Passphrase", add
`autoComplete="current-password"` so password managers fill it.

---

## P1 — Correctness and data loss

### 5. Editing a set you just logged can silently lose the edit

`src/components/session/outbox.ts:36-40`. `drain()` snapshots the queue, sends
it, then deletes everything matching the sent keys — but `enqueue()` (line 16)
*replaces* an entry with the same `(session, block, slot, set)` key.

Sequence: you log set 3 at 100 kg. `drain` starts sending. Mid-flight you notice
it was 105 and correct it — `enqueue` swaps the row in place under the same key.
`drain` returns, sees that key in `sent`, and deletes your correction **without
ever sending it**. The server keeps 100 kg. The chip shows 0 queued. Nothing
looks wrong.

The comment on line 32 says "anything logged during the flush survives" — that
holds for a *new* key, not a *revised* one. Revising is reachable: `SetRow`
stays expandable after completion and its "Log set" button re-submits
(`SetRow.tsx:154`). Fixing a mistyped weight is one of the most common things
anyone does in a gym.

**Fix:** version each row. Stamp a monotonic `seq` (or reuse `clientLoggedAt`) on
enqueue, and in the cleanup drop only rows whose `seq` matches what was sent:

```ts
const sent = new Map(queue.map((r) => [key(r), r.clientLoggedAt]));
const remaining = after.filter((r) => sent.get(key(r)) !== r.clientLoggedAt);
```

**Verify:** a unit test — enqueue A, start a `drain` whose `send` blocks,
enqueue A′ with the same key, resolve `send`, assert A′ is still queued.

### 6. Two sets logged in the same instant can drop one

Same file, `enqueue` (line 15-18) is a read-modify-write across two separate
`idb-keyval` transactions. Two taps close together — which is exactly what a
superset is — can interleave and lose one write. Add a promise-chain mutex, or
move to a single IndexedDB transaction / `idb-keyval`'s `update()`.

### 7. "Today" is computed in UTC, so it is wrong every evening

`src/app/today/page.tsx:43`:
```ts
const today = new Date().toISOString().slice(0, 10);
```
This runs on a Vercel function, in UTC. In Stockholm (UTC+1/+2) every session
between 22:00 and midnight local is dated to *yesterday*; sessions become
"Missed" while you are still standing in the gym. West of UTC it fails the other
way. `/today` is the app's front door and its whole job is deciding today vs.
overdue.

Same pattern, same bug, in seven more places:

| File | Line | What it dates wrong |
|---|---|---|
| `src/server/actions.ts` | 97 | program start date |
| `src/server/actions.ts` | 285 | scheduled routine start date |
| `src/server/repo.ts` | 125 | which training max is in effect |
| `src/server/repo.ts` | 142 | training max effective-from |
| `src/server/repo.ts` | 297 | pain flag expiry |
| `src/server/repo.ts` | 305 | which pain flags are active |
| `src/server/analytics.ts` | 170 | streak / consistency "today" |
| `src/components/charts/Heatmap.tsx` | 33 | heatmap cell dates |

There is no timezone handling anywhere in the codebase — `grep -ri timezone src/`
returns nothing.

**Fix:** add `timezone` to `t4m_profile` (default `Europe/Stockholm`), and a
single `todayInProfileTz()` helper in `src/core`. Replace all eight call sites.
Make it a lint rule or a test that `toISOString().slice(0, 10)` appears nowhere
outside that helper.

### 8. Finishing a session can miss your PRs

`src/server/actions.ts:161-186`. `finishSession` reads `repo.getLoggedSets()` and
runs `detectPRs` against it. But the client's Finish button
(`SessionPlayer.tsx:271-275`) does:

```ts
await flush();
await finishSession(session.id, elapsed);
router.push('/today');
```

`flush()` **swallows failure** — `drain` returns the remaining count and
`setQueued` records it; nothing throws, nothing branches. So if you finish while
offline (a basement gym, exactly the case the outbox exists for), `finishSession`
runs against a partial set of logs. `detectPRs` never sees the un-synced sets.
When the queue drains later, PR detection has already run and will not run again.
Your best triple in months quietly never appears in Records.

The dialog even tells you it is fine — "They will send as soon as you are back
online" (`SessionPlayer.tsx:264`) — which is true for the *sets* and false for
the *PRs*.

**Fix:** either block finishing until the queue is empty, or (better) move PR
detection server-side into `logSets` so it is incremental and order-independent.
The second also fixes PRs for sets that arrive days later.

### 9. Finish and Begin ignore their own results

- `SessionPlayer.tsx:273` — `await finishSession(...)` returns a
  `Result<...>` that is discarded, then `router.push('/today')` runs
  unconditionally. If it failed, you are told the session is complete and it is
  not.
- `SessionPlayer.tsx:133` — `beginSession(session.id, null)` on "skip
  readiness" is fire-and-forget, not awaited, no `.catch()`. If it fails the
  session never gets `started_at`, so the elapsed timer restarts from zero on
  every reload, and an unhandled rejection surfaces in the console.

**Fix:** check `result.ok` in both; show the error and keep the user where they
are.

### 10. The RPE backoff is thrown away if you reload

`SessionPlayer.tsx:59` — `hardSets` is a `useRef` starting at 0, and the
backed-off weights live only in the `blocks` state (line 96-103). Nothing is
persisted. Reload mid-session — phone died, browser evicted the tab, you
navigated to check an exercise — and you come back to the original heavy
prescription with the counter reset to zero.

The README sells this as a headline adaptation: *"During — an RPE of 9.5 on a
main set backs the next one off 5%; twice and the rest of the lift drops 10%."*
In practice it survives only as long as the tab does.

**Fix:** persist the adjusted `blocks` and `hardSets` to the session row (there
is already an `autoregulated` column) when the backoff fires, the same way
`beginSession` persists the readiness adjustment.

### 11. The screen stops staying awake after the first interruption

`SessionPlayer.tsx:67-71` requests a wake lock once on mount. Browsers
**automatically release** a screen wake lock whenever the document becomes
hidden — you lock the phone, you switch to your music app. There is no
`visibilitychange` listener to re-request it, so for the rest of the workout the
screen sleeps normally. The comment says "Keep the screen on while the player is
open"; it does that exactly once.

**Fix:** the standard re-acquire pattern —
```ts
const reacquire = () => {
  if (document.visibilityState === 'visible') {
    navigator.wakeLock?.request('screen').then((s) => { sentinel = s; }).catch(() => {});
  }
};
document.addEventListener('visibilitychange', reacquire);
```

### 12. The rest timer cannot get your attention

`RestTimer.tsx:32-38` alerts with `navigator.vibrate` and nothing else. Three
problems compound:

- **`navigator.vibrate` is not supported in Safari on iOS at all.** On an
  iPhone — the likeliest gym device — rest ends with no signal whatsoever.
- The 250 ms `setInterval` (line 26) is throttled hard in background tabs, so
  when you have switched apps `remaining` may never reach 0 and the vibrate
  never fires anyway.
- There is no sound, and combined with #11 the screen is off by then.

So the timer works when you are already looking at it, which is when you least
need it.

**Fix:** add a short WebAudio beep (unlocked by the first user tap, which the
session player always has), and schedule the alert against the absolute `endsAt`
rather than polling — `setTimeout(endsAt - Date.now())` survives throttling far
better. Keep vibrate as the extra where supported.

### 13. History silently stops at 40 sessions

`src/server/repo.ts:282` — `recentSessions(limit = 40)`, called with no argument
from `src/app/history/page.tsx:21`. No pagination, no "load more", no date
filter. At four sessions a week that is ten weeks. After roughly three months
your older training simply stops being reachable through the UI — the rows are
still in Postgres, but nothing in the app will ever show them again.

For an app whose entire value compounds over time, this is the quietest and
worst of the bugs here.

**Fix:** paginate (cursor on `scheduled_date`), plus a year or block filter. While you
are in there, PRs are capped at 12 with no "see all"
(`history/page.tsx:34`).

### 14. Set counts disagree with block completion

`SessionPlayer.tsx:123` builds `totals` from sets **excluding** `kind === 'ramp'`;
`SessionPlayer.tsx:160-162` builds `blockDone` from **all** sets including ramps.
A block with ramp sets can read "12/12 sets" in the header while its accordion
still shows as not done. Pick one rule — ramp sets are warm-ups and should
probably count in neither.

---

## P2 — What is missing (this is the "more useful" half)

### 15. A finished session is a black box

There is no route to view what you actually did in a completed session. History
(`src/app/history/page.tsx`) renders title, date, duration, readiness chip — and
none of the rows are links. The logged sets exist in `t4m_logged_set` and are
rendered nowhere.

So: you cannot review last Tuesday's squats, and you cannot fix a weight you
mistyped once the session is finished. The app is a write-only log with a
summary view. This is the single biggest gap between it and StrengthLog.

**Build:** `/session/[id]/summary` (or make the player read-only when
`status === 'completed'`) showing every block, every set, actual vs. prescribed,
RPE, PRs hit, and an edit affordance per set that re-uses `logSets`' existing
upsert.

### 16. There is no way to get your data out

No CSV, no JSON, no backup. Years of training data live in one table in a
Supabase project shared with unrelated apps, reachable only through this UI. If
the project is paused, the key rotates, or a bad migration lands, there is no
copy.

**Build:** a `/profile/export` that streams CSV of `t4m_logged_set` joined to
sessions and exercise names, and a full JSON dump. It is an afternoon of work
and it is the difference between a log you trust and one you hope about.

### 17. No plate math

For an app whose whole thesis is a heavy barbell base, it tells you `102.5 kg`
and stops. Standing at the rack you want *"20 + 15 + 5 + 1.25 per side."* The
profile already knows about `microPlates` (`repo.ts` `Profile.microPlates`), so
the available plates are half-modelled already.

**Build:** a pure `plateBreakdown(targetKg, barKg, availablePlates)` in
`src/core` — trivially testable, fits the architecture exactly — surfaced under
the weight on every loaded set in `SetRow`.

### 18. Entering a weight means tapping "+" forty times

`SetRow.tsx:161-181` — the `Stepper` is the *only* way to set reps or weight.
There is no text input. Usually the prescription pre-fills it, but any real
correction (dropped to a lighter dumbbell, machine in a different unit, a
bodyweight movement you loaded) is punitive: 0 → 102.5 kg at a 2.5 step is 41
taps.

**Fix:** make the number itself a tap-to-edit numeric field. Keep the steppers.

### 19. Nothing tracks bodyweight over time

`bodyweight_kg` is a single scalar on the profile, set once at onboarding and
used for load calculations. It is never re-asked and never charted. For a
strength app, bodyweight is half of every meaningful ratio, and "look good, move
well" is in the stated philosophy.

**Build:** a `t4m_bodyweight` table (date, kg), a prompt on the profile, and a
line on the analysis page. Relative-strength charts fall out for free.

### 20. Any client error is a white screen with no way back

There is no `error.tsx`, no `global-error.tsx`, and no `not-found.tsx` anywhere
under `src/app`. A render error in production gives Next's bare "Application
error: a client-side exception has occurred," and a bad URL gives the unstyled
default 404. Installed as a standalone PWA there is no address bar, so a user
who hits either is genuinely stuck — no nav, no back, nothing.

**Fix:** add all three, themed, each with a link back to `/today`. This is maybe
thirty lines and it is the highest value-per-line item in this document.

### 21. The lock screen is a 176 kB blank page

The one screen every visit passes through:

```
○ /unlock    2.85 kB    176 kB First Load JS
```

And the live HTML contains `BAILOUT_TO_CLIENT_SIDE_RENDERING` — the page is
`'use client'` (`unlock/page.tsx:1`) with `useSearchParams` in a `Suspense` that
has **no fallback** (line 50). So the server sends an empty body and the user
stares at background colour until 176 kB of MUI parses. On gym wifi that is
seconds of nothing, every time the 90-day cookie lapses.

**Fix:** make it a server component with a plain
`<form action={unlockAction}>` — no `useRouter`, no `useSearchParams` (carry
`next` in a hidden input), no MUI. Renders instantly at roughly 0 kB of JS, and
it keeps working with JavaScript disabled. This pairs naturally with splitting
`unlock` out of `actions.ts` for #1.

### 22. Every page carries the whole exercise library

`src/core/library/exercises/` is 123 kB of source across ~300 exercises.
`ExerciseBrowser.tsx:19` and `ExercisePickerDialog.tsx:19` import all of
`EXERCISES`, and `getExercise` drags the full `BY_ID` map into `format.ts` —
which nearly every client component imports transitively. It shows:

```
/exercises              214 kB
/session/[id]           232 kB
/program/builder/[id]   246 kB
```

**Fix:** keep the full library server-side; ship clients a slim
`{id, name, muscle}` index and fetch detail on demand. Filtering and search move
to the server. Should take 40-60 kB off the three heaviest routes.

### 23. Sharing the URL shows nothing, and there is no robots.txt

`src/app/layout.tsx:7-12` sets title and description but no `openGraph`, no
`twitter`, no OG image. Pasting the link anywhere renders a bare URL. There is
also no `robots.ts` — `/unlock` returns 200 and is prerendered, so it is
indexable.

**Fix:** add `openGraph`/`twitter` metadata with a generated OG image
(`opengraph-image.tsx`), and a `robots.ts` that disallows everything.

### 24. Nothing ever reminds you to train

No push notifications, no scheduled reminders. The service worker is registered
(`RegisterServiceWorker.tsx`) and a PWA install is supported, so the delivery
mechanism is already sitting there unused. A training app that never speaks
first is one you stop opening in week three.

**Build:** Web Push on session days, and an "are you finishing this?" nudge for
a session left `in_progress` overnight.

---

## P3 — Engineering hygiene

### 25. Nothing runs the tests

There is no `.github/workflows/` at all. 242 tests, a custom lint rule that
enforces `src/core` purity, and a typecheck — none of it gates anything.
Production deploys straight from a branch push.

**Fix:** a workflow running `pnpm lint && pnpm typecheck && pnpm test` on push
and PR. Given how good the test suite is, leaving it ungated is the odd part.

### 26. Nothing tells you when production breaks

No `@vercel/analytics`, no Speed Insights, no error reporting, no uptime check.
If the app started 500ing you would find out the next time you tried to train.

**Fix:** `@vercel/analytics` and `@vercel/speed-insights` are two lines each.
Add Sentry (or at minimum an error boundary that reports) once #20 exists.

### 27. Zero tests touch the UI

13 test files: all of `src/core`, four in `src/server`, one in
`components/builder/editable.ts`. Not one renders a component. `@testing-library/react`
and `jsdom` are already installed and configured in `vitest.setup.ts` — the
harness is there, unused.

The pure logic is genuinely well tested; the part the user actually touches is
not tested at all. Every P1 bug above lives in that untested layer, which is not
a coincidence.

**Fix, in priority order:** `outbox.ts` (#5, #6 — pure async, trivial to test),
`SetRow` submit behaviour, `SessionPlayer` finish flow (#8, #9), and the
`middleware`/action authorization boundary (#1).

### 28. Two README claims no longer match the code

- *"wrong guesses are slowed down"* — see #3; 400 ms serial is not a throttle.
- *"RLS is enabled with policies scoped to exactly those tables"* — true as
  stated, but a reader takes "scoped" to mean restrictive, and every policy is
  `USING (true)` for `anon`. Say so plainly.

Worth a pass over `docs/DECISIONS.md` at the same time.

---

## Suggested order

1. **#1, #2** — the lock is currently decorative. Everything else is moot if
   someone wipes the log.
2. **#20, #25** — thirty lines and one workflow file; they make everything after
   this safer to ship.
3. **#5, #6, #8** — active data loss in the offline path, which is the feature
   the gym use case depends on most.
4. **#7** — one helper, eight call sites, fixes a class of wrongness.
5. **#15, #16** — the two gaps that most change what the app is worth.
6. **#11, #12, #21** — the "does it actually work in a gym" trio.
7. Everything else.

Items #1, #5, #7, #8, #13 and #20 are the ones I would not leave in place for
another training block.
