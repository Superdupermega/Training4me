# Chunk 12 — Polish and ship

**Read first:** `docs/00-CONTEXT.md`, then `docs/04-DESIGN-SYSTEM.md §6, §7`
and `docs/03-ARCHITECTURE.md §9`.
**Depends on:** all. **Size:** M.

## Mission
Make it something you'd trust on a Monday morning with cold hands.

## Deliverables

1. **Error handling**
   - `error.tsx` and `not-found.tsx` at the app-group level with plain,
     non-technical copy and a way back.
   - Every server action failure surfaces as a `Snackbar` with a retry where retrying is safe.
   - A top-level error boundary around the session player that preserves the
     outbox — a crash must never lose logged sets.
2. **Empty states** — every list has one, each naming the next action:
   no program, no history, no PRs, no sessions this week, offline with empty cache.
3. **PWA**
   - `manifest.webmanifest` (name, short name, theme colour = M3 primary,
     maskable icons 192/512), `apple-touch-icon`.
   - A minimal service worker: app-shell cache + the active session, network-first
     for data, cache-first for static. Nothing clever, nothing that can serve stale
     prescriptions — the session cache is keyed by session id and version.
   - "Add to home screen" hint shown once, dismissible, stored in `localStorage`.
4. **Accessibility pass**
   - Contrast audit of both schemes against the §7 thresholds; fix failures in
     `tokens.ts`, not with one-off overrides.
   - `aria-label` on every icon button; verify focus order in the player.
   - Test the full session flow with a screen reader once and note the result
     in `docs/PROGRESS.md`.
5. **Performance**
   - Check bundle size; dynamic-import the chart library so `/plan` doesn't pay for it.
   - Confirm `/plan` LCP < 2.0 s on a throttled mid-range profile.
   - Add `loading.tsx` skeletons wherever one is missing.
6. **E2E — `tests/e2e/`** with Playwright:
   - `onboarding.spec.ts` — sign in (test user) → six steps → plan exists
   - `session.spec.ts` — start a session → log every set → finish → history shows it
   - `offline.spec.ts` — go offline mid-session, log sets, come back online, assert one row per set
   - `a11y.spec.ts` — `@axe-core/playwright` on `/plan` and `/session/[id]`, zero serious/critical violations
   - Wire E2E into CI as a separate job with a seeded test user.
7. **Deploy**
   - `vercel.json` if needed; set env vars in the Vercel project (never committed).
   - Deploy via the Vercel MCP tools, confirm the deployed app signs in and loads a plan.
   - Add the production URL to `README.md`.
8. **Docs** — finish `README.md` with setup, scripts, architecture summary and a
   short "how the program is generated" section for future-you.

## Acceptance criteria
- [ ] Lighthouse: a11y ≥ 95, PWA installable, performance ≥ 85 on `/plan`.
- [ ] All four E2E specs green in CI.
- [ ] Deployed URL works end-to-end on a real phone.
- [ ] Four green commands plus `pnpm test:e2e`.

## Do NOT
- Do not add features here. Polish only.
- Do not cache prescriptions in a way that can serve a stale load.

## Commit
`feat: production polish, PWA, accessibility, E2E tests and deploy`
