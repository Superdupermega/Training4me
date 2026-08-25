# Chunk 14 — Performance & responsiveness

**Read first:** `docs/06-REDESIGN-PLAN.md` §2. **Depends on:** nothing.
**Size:** S. **Ships first — everything after is judged on a fast app.**

## Mission

Make every menu tap feel instant. Four compounding causes, fixed in this order.

## 1. Region — the biggest raw win, two lines

Supabase is in `eu-north-1` (Stockholm). Vercel Hobby defaults to `iad1`
(Washington DC). Every query crosses the Atlantic twice.

Create `vercel.json` at the repo root:

```json
{ "regions": ["arn1"] }
```

`arn1` is Stockholm. Hobby allows exactly one region, which is fine. Redeploy —
region changes need a new build. Expect ~150–180 ms off every server render.

## 2. Nav feedback — prefetch and optimistic highlight

`src/components/AppShell.tsx` today: `onChange={(_, v) => router.push(v)}`.
`router.push` never prefetches, and `usePathname()` only updates after the
navigation commits, so the pressed tab does not even light up.

Rewrite so that:

- each `BottomNavigationAction` is `component={Link} href={tab.value}` — this
  gives Next's viewport prefetch for free;
- the selected value comes from `useOptimistic` (or a `useState` seeded from
  `usePathname` and set in the click handler inside `startTransition`), so the
  pressed tab highlights on the same frame as the tap;
- `usePathname` reconciles the optimistic value when the route commits.

```tsx
const pathname = usePathname();
const active = TABS.find((t) => pathname.startsWith(t.value))?.value ?? TABS[0].value;
const [optimistic, setOptimistic] = useOptimistic(active);
const [, startTransition] = useTransition();
// onClick: startTransition(() => setOptimistic(tab.value))
```

Do the same for the navigation rail added in chunk 15 — share one `<NavItems>`.

## 3. Suspense — a skeleton on every route

There is no `loading.tsx` anywhere in `src/app`. Add one per route segment,
each rendering MUI `<Skeleton />`s **in the shape of the final page** (never a
centred spinner — see `docs/04-DESIGN-SYSTEM.md` §4).

Add: `src/app/today/loading.tsx`, `program/loading.tsx`, `exercises/loading.tsx`,
`history/loading.tsx`, `profile/loading.tsx`, `session/[id]/loading.tsx`.
(Create the ones for routes that exist now; chunk 15 adds the rest with the
routes.)

Extract the shared skeletons into `src/components/skeletons/` so a page and its
`loading.tsx` cannot drift apart.

## 4. Query layer — one client, parallel reads, cached where sane

In `src/server/db.ts`, `db()` calls `createClient` on **every** call. Memoise it
at module scope:

```ts
let client: SupabaseClient | null = null;
export function db() { return (client ??= createClient(SUPABASE_URL, resolveKey().key, { auth: { persistSession: false } })); }
```

In `src/app/plan/page.tsx` (and its successor `/program`), the three awaits are
serial. Collapse them:

```ts
const [profile, program] = await Promise.all([getProfile(), getActiveProgram()]);
const sessions = program ? await listSessions(program.id) : [];
```

Then drop `force-dynamic` where it is not needed. Profile and program change
only through server actions we control, so use tags:

- wrap reads in `unstable_cache` with tags `profile`, `program`, `sessions`,
  `logs`;
- every mutation in `src/server/actions.ts` calls `revalidateTag(...)` for what
  it touched, instead of the current path-based `revalidatePath`.

Keep `force-dynamic` on `/session/[id]` — it is genuinely per-request.

## 5. Middleware — stop running on RSC payloads and static assets

`src/middleware.ts` matches nearly everything. Tighten the matcher to exclude
`_next/*` fully, `icon*`, `manifest.webmanifest`, `favicon.ico` and `*.svg`, and
hoist `deriveToken(pin)` out of the request path by memoising it per module
instance (the PIN cannot change without a redeploy).

## 6. Bundle

- Confirm every `@mui/*` import is a **deep default import**
  (`import Button from '@mui/material/Button'`) — it is today; keep it that way,
  and add an ESLint rule (`no-restricted-imports`) banning
  `import { X } from '@mui/material'` so it stays that way.
- Run `ANALYZE=1 pnpm build` with `@next/bundle-analyzer` (dev dep) once and
  record first-load JS per route in `docs/PROGRESS.md`.

## Acceptance

- [ ] `vercel.json` pins `arn1`; a deployed `/today` server render is measurably
      faster than before (record both numbers in `PROGRESS.md`).
- [ ] Tapping a nav item highlights it on the same frame, with no navigation
      committed yet.
- [ ] Every route segment has a `loading.tsx` rendering a shaped skeleton.
- [ ] No page issues serial Supabase queries that could run in parallel.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build` clean.

## Do not

- Do not add a client-side data-fetching library. Server components plus tags
  are enough for one user.
- Do not turn the whole app into client components to "make it snappy". The fix
  is prefetch + Suspense + latency, not CSR.
