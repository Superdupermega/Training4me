# Chunk 01 — Scaffold & toolchain

**Read first:** `docs/00-CONTEXT.md`. Nothing else.
**Depends on:** nothing. **Size:** M.

## Mission
Create a Next.js 15 + TypeScript app that boots, is themed with Material 3, and
has lint/typecheck/test/build wired so every later chunk has a green baseline.

## Deliverables

1. **Project init** at the repo root (the repo currently contains only `docs/`):
   - `pnpm dlx create-next-app@latest . --ts --app --eslint --src-dir --import-alias "@/*" --no-tailwind`
   - Next 15, React 19, TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
2. **Dependencies**
   - runtime: `@mui/material @emotion/react @emotion/styled @mui/material-nextjs @fontsource-variable/roboto-flex zod date-fns`
   - dev: `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom eslint-plugin-import prettier`
3. **`src/theme/`**
   - `tokens.ts` — the M3 role tokens for light and dark from source colour
     `#1E5F4B`, plus the semantic aliases in `docs/04-DESIGN-SYSTEM.md §1`.
     Hand-written constants are fine; no colour-generation library.
   - `theme.ts` — `createTheme` for light and dark, Roboto Flex, M3 type scale
     overrides, shape radii (12/16/full), `components` overrides so
     `Button` defaults to `contained` + `size="large"` + `fullWidth: false`
     with a 56 px min-height variant, and tabular numerals on `displaySmall`.
   - `ThemeRegistry.tsx` — client component wiring `AppRouterCacheProvider`,
     `CssBaseline`, and a `ColorSchemeProvider` that respects system preference
     and stores an override in `localStorage` (wrapped in try/catch).
4. **App shell**
   - `src/app/layout.tsx` — html lang="en", theme registry, font, viewport meta
     with `viewport-fit=cover`.
   - `src/app/page.tsx` — a placeholder home showing the app name and a
     `Button`, proving the theme applies. It will be replaced in chunk 09.
   - `src/components/BottomNav.tsx` — the 4-item M3 bottom navigation
     (Plan · Session · History · Settings), not yet wired to real routes.
5. **Tooling**
   - `vitest.config.ts` — jsdom env, `@/` alias, `setupFiles` with
     `@testing-library/jest-dom`, coverage text reporter.
   - `.eslintrc` / `eslint.config.mjs` — Next core-web-vitals + a
     `no-restricted-imports` zone that **forbids importing anything outside
     `src/core`, `zod` and `date-fns` from within `src/core/**`**, and forbids
     importing `src/server/**` from client components.
   - `prettier` config (2 spaces, single quotes, 100 cols, no semicolons off —
     keep semicolons) and `.editorconfig`.
   - `package.json` scripts: `dev`, `build`, `start`, `lint`, `typecheck`
     (`tsc --noEmit`), `test` (`vitest run`), `test:watch`, `format`.
6. **CI** — `.github/workflows/ci.yml`: on push/PR, Node 20, pnpm cache,
   `pnpm install --frozen-lockfile`, then lint, typecheck, test, build.
7. **Env** — `.env.example` with the three Supabase vars (empty values) and a
   comment that `SUPABASE_SERVICE_ROLE_KEY` is server-only. `.gitignore` must
   already exclude `.env*.local`; verify it does.
8. **Docs** — create `docs/PROGRESS.md` (with your entry) and `docs/DECISIONS.md`
   (empty template: date · decision · why).
9. **One smoke test** — `src/theme/theme.test.ts` asserting the dark theme's
   `primary.main` differs from light and that both define every semantic alias.

## Acceptance criteria
- [ ] `pnpm dev` renders a themed page with no console errors or hydration warnings.
- [ ] Toggling the OS to dark mode changes the palette.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- [ ] Creating `src/core/scratch.ts` that imports `react` makes `pnpm lint` fail
      (verify this manually, then delete the file). **This proves the core rule works.**
- [ ] CI workflow file is valid YAML and mirrors the four commands.

## Do NOT
- Do not add Tailwind, a state library, an ORM, or any component kit besides MUI.
- Do not create database code, exercise data, or generator files — later chunks.
- Do not scaffold routes beyond `/` and the layout.

## Commit
`chore: scaffold Next 15 + MUI Material 3 app with lint, test and CI`
