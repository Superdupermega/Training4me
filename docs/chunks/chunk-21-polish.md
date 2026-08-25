# Chunk 21 — Polish, accessibility, PWA, docs

**Depends on:** all. **Size:** M. Close-out.

## 1. Known defects to fix

Found while planning; each is small and independently verifiable.

| # | File | Defect |
|---|---|---|
| 1 | `src/components/session/outbox.ts` | `drain()` builds its `sent` key as `blockLetter:slot:setNumber` while `enqueue()` keys on `sessionId:blockLetter:slot:setNumber`. Draining while sets from *another* session sit in the queue can drop them. Include `sessionId` in both. |
| 2 | `src/components/session/SetRow.tsx` | `useState(logged?.weightKg ?? set.weightKg ?? 0)` never resyncs. After the RPE ≥ 9.5 autoregulation drops the remaining sets by 5–10 %, the expanded editor still offers the **old** weight. Key the row on the prescribed weight, or reset in an effect when `set.weightKg` changes. |
| 3 | `src/components/session/SetRow.tsx` | The row is `role="button"` with an `IconButton` nested inside it — nested interactive elements, which breaks keyboard and screen-reader navigation. Make the row a `ListItemButton` with the check as a sibling `secondaryAction`. |
| 4 | `src/app/plan/page.tsx` (→ `/program`) | `Math.max(...sessions.map(...))` is `-Infinity` when `sessions` is empty. Guard it. |
| 5 | `src/app/onboarding/Wizard.tsx` | The equipment `Chip` handler pushes `'none'` into the array on every toggle-on; it is de-duped afterwards, but the intent is muddled — set `'none'` once when the profile is chosen. |
| 6 | `src/core/library/exercises.ts` | `single-leg-glute-bridge` and `bodyweight-split-squat` sit under the `hinge` comment block but `bodyweight-split-squat` is `pattern: 'lunge'`. Cosmetic, but it will confuse the chunk-16 split. |

## 2. Accessibility

- Every interactive target ≥ 48 × 48 px (theme already does this for `Button`;
  extend to `ListItemButton`, `Chip` with `onClick`, chart points).
- Colour contrast ≥ 4.5:1 for text in both schemes — verify the new
  `primaryContainer` cards from chunk 15 §5.
- `aria-live` on the set counter (exists) and on the rest timer (missing).
- Full keyboard path through the builder, including reorder without drag.
- Respect `prefers-reduced-motion`: disable the accordion and rest-timer
  transitions.

## 3. PWA

- `src/app/manifest.ts` is 14 lines; fill it out: `id`, `scope`, `categories`,
  `screenshots`, maskable icons at 192/512, `display: 'standalone'`,
  `orientation: 'portrait'`.
- Add a service worker for the app shell so `/today` opens offline. The session
  player is already local-first via `outbox.ts`; the shell is not.
- App icons: the repo still ships the Next.js starter SVGs in `public/`
  (`next.svg`, `vercel.svg`, `window.svg`, `file.svg`, `globe.svg`). Delete
  them and add real icons.

## 4. Performance budget — enforce it

Record in `docs/PROGRESS.md` and check at the end of every later chunk:

| Route | First-load JS (gzip) |
|---|---|
| `/today` | ≤ 130 kB |
| `/exercises` | ≤ 160 kB |
| `/program/builder` | ≤ 190 kB |
| `/session/[id]` | ≤ 170 kB |

If a chunk blows a budget, that is a finding to report, not a number to edit.

## 5. Documentation

- **Rewrite `docs/02-DATA-MODEL.md`** to describe the schema that actually
  exists (`t4m_*`, single-user, JSONB blocks) rather than the multi-user,
  fully-normalised one that was planned and never built. It currently misleads
  anyone who reads it. Keep the old version as an appendix marked *not built*.
- Update `docs/04-DESIGN-SYSTEM.md` §4 for the five-destination IA.
- Update `README.md`: the new IA, the builder, the `arn1` region requirement,
  and the `pnpm test` count.
- Append to `docs/PROGRESS.md` after every chunk, in the existing format.
- Record every deviation from this plan in `docs/DECISIONS.md` with the reason.

## Acceptance

- [ ] All six defects in §1 fixed, each with a regression test where testable.
- [ ] Keyboard-only pass through onboarding, builder and player succeeds.
- [ ] `/today` loads offline after one visit.
- [ ] No route exceeds its budget.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm build` clean.
