# Tightening the database — ready to run, blocked on one manual step

Part of docs/07-PRODUCTION-REVIEW.md #2. This is the one review item that
genuinely cannot be finished by an agent: it requires revealing a secret
credential from the Supabase dashboard and pasting it into Vercel, which is
deliberately not something any tool here can do unattended.

## Why this order matters

Right now every `t4m_` table's RLS policy is `USING (true)` for `anon`, and
the app connects with the publishable key (`src/server/db.ts`). Tightening
the policies to `service_role` only **before** the app is configured to use a
secret key would take production down immediately — every read and write
would start failing with a permissions error, for the one person this app
exists for. So the order is fixed: env var first, confirmed working, **then**
tighten.

## Step 1 — you, in the Supabase and Vercel dashboards (no code change)

1. Supabase dashboard → **cyberpunk-vibe01** project → **Project Settings →
   API Keys → Secret keys** → reveal and copy the key starting `sb_secret_`.
2. Vercel dashboard → **training4me** project → **Settings → Environment
   Variables** → add `SUPABASE_SECRET_KEY` for **Production**, paste the key.
3. Redeploy (Deployments → latest → ⋯ → Redeploy — env changes need a new
   build). `src/server/db.ts`'s `resolveKey()` already picks up a configured
   secret key automatically; no code change is needed here.
4. Confirm the app still works: open the live site, unlock it, check that
   `/today` and `/history` still load. `connectionSummary()` (visible on the
   `SetupNeeded` screen if something's wrong) will say `source=SUPABASE_SECRET_KEY`
   once it's picked up.

## Step 2 — tell me, or run this yourself

Once step 1 is confirmed working, the migration below drops the `anon` /
`authenticated` grant from every `t4m_` table so the publishable key stops
reaching them at all — closing the trade-off the README currently documents
as open. I have this ready to apply via Supabase's migration tool the moment
you confirm step 1 is done; I did not apply it now because doing so first
would have broken the live site.

```sql
-- Tighten every t4m_ table to service_role only, now that the app
-- authenticates with the secret key. Drops the wide-open anon/authenticated
-- grant each table currently carries (`USING (true)` for both roles).
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename like 't4m/_%' escape '/'
      and tablename !~ '_(pkey|key)$'
  loop
    execute format('drop policy if exists %I on public.%I', t || '_app', t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      t || '_service', t
    );
  end loop;
end $$;
```

The loop discovers tables by name pattern at execution time, so it covers
every `t4m_` table that exists when it runs, not a fixed list written down
when this doc was drafted — currently 12: `t4m_profile`, `t4m_session`,
`t4m_logged_set`, `t4m_program`, `t4m_pr`, `t4m_pain_flag`, `t4m_training_max`,
`t4m_routine`, `t4m_routine_day`, `t4m_routine_item`, `t4m_custom_exercise`,
`t4m_bodyweight`. It does **not** touch `t4m_rate_limit` (added alongside
this review, already has no client-facing policy at all — see
`src/server/rateLimit.ts`) or anything outside the `t4m_` prefix, matching
this app's existing documented isolation from the rest of that Supabase
project.

**Verify afterward:** the app should still work end-to-end (it now talks to
Postgres as `service_role`, which bypasses RLS entirely — that's the point).
Separately, confirm the publishable key can no longer read anything:

```bash
curl 'https://evlxbewvsgrlncvtagmf.supabase.co/rest/v1/t4m_profile?select=*' \
  -H 'apikey: sb_publishable_vpwx3wRY7j-5xsIe0-jjyA_olXG2fl9'
```

Expect `[]` or a permission-denied error, not your profile.
