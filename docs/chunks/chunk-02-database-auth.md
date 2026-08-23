# Chunk 02 — Database, RLS and auth

**Read first:** `docs/00-CONTEXT.md`, then `docs/02-DATA-MODEL.md` in full.
**Depends on:** 01. **Size:** M.

## Mission
Stand up the complete Postgres schema with RLS, plus magic-link auth, so later
chunks have real, typed, secure persistence.

## Deliverables

1. **Migrations** in `supabase/migrations/`, numbered and idempotent-safe:
   - `0001_extensions.sql` — `pgcrypto` (for `gen_random_uuid`).
   - `0002_profiles.sql` — `profiles` table exactly as specified, plus the
     `handle_new_user()` trigger on `auth.users` that inserts a default profile.
   - `0003_exercises.sql` — the `exercises` table + check constraints for
     `pattern`, `tier`, `complexity` using the literals from
     `docs/01-METHODOLOGY.md §4.1` and `§4.2`. **No seed data yet** (chunk 03).
   - `0004_training.sql` — `training_maxes`, `programs`, `sessions`,
     `session_blocks`, `block_exercises`, `prescribed_sets`.
   - `0005_logging.sql` — `logged_sets`, `personal_records`, `pain_flags`.
   - `0006_rls.sql` — enable RLS on every user table, owner policies, join
     policies for the three child tables, `exercises` select-only-for-all.
   - `0007_indexes.sql` — every index in `docs/02-DATA-MODEL.md §3`, including
     the partial unique index for one active program per user.
   - `0008_persist_program.sql` — a `persist_program(payload jsonb)` plpgsql
     function, `security invoker`, that inserts a program + its sessions,
     blocks, block_exercises and prescribed_sets **in one transaction** and
     returns the new program id. It must reject payloads whose `user_id`
     ≠ `auth.uid()`.
2. **Apply the migrations** to the Supabase project via the Supabase MCP tools
   (`apply_migration`), one call per file, in order.
3. **Generated types** — `src/lib/database.types.ts` via
   `generate_typescript_types`. Committed.
4. **Clients**
   - `src/server/supabase/server.ts` — `createClient()` using `@supabase/ssr`
     with the Next 15 async `cookies()` API. `import 'server-only'` at the top.
   - `src/server/supabase/admin.ts` — service-role client, `server-only`,
     with a comment that it must never be used inside a request handler.
   - `src/lib/supabase/client.ts` — browser client for auth flows only.
5. **Auth**
   - `src/middleware.ts` — refresh session cookies; redirect unauthenticated
     users away from `(app)` routes to `/sign-in`.
   - `src/app/(auth)/sign-in/page.tsx` — M3 email field + "Send magic link"
     button, `Snackbar` on success, inline error on failure.
   - `src/app/auth/callback/route.ts` — exchange code for session, redirect to
     `/` (which will route onward).
   - `src/server/auth.ts` — `requireUser()` returning the user or redirecting.
6. **Root routing** — `src/app/page.tsx` becomes a server component that
   redirects: no session → `/sign-in`; profile incomplete (`days_per_week` null)
   → `/onboarding`; otherwise → `/plan`. Stub `/onboarding` and `/plan` pages
   with a heading only.
7. **RLS test** — `src/server/supabase/rls.test.ts`, skipped automatically when
   env vars are absent, that creates two users and asserts user B cannot read
   user A's `sessions` row.

## Acceptance criteria
- [ ] `list_tables` shows all 10 tables with RLS enabled (except `exercises`).
- [ ] `get_advisors` for security returns **no errors** (warnings triaged in `docs/PROGRESS.md`).
- [ ] Sending yourself a magic link signs you in and lands on `/onboarding`.
- [ ] A profile row is auto-created on first sign-in.
- [ ] Four green commands.

## Do NOT
- Do not seed exercises (chunk 03) or write repositories/actions (chunk 07).
- Do not put the service-role key anywhere near a `NEXT_PUBLIC_` var or a client component.
- Do not disable RLS "temporarily".

## Commit
`feat: add Postgres schema, RLS policies and magic-link auth`
