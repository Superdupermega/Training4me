# Turning on push reminders

Part of docs/07-PRODUCTION-REVIEW.md #24. Everything is built and wired —
the subscription flow, the service worker's push handler, the sender, the
two cron-triggered checks — but two secrets have to be set by hand before
any of it actually sends anything. Same shape as `SUPABASE_SECRET_KEY`
(docs/08-RLS-TIGHTENING.md): no tool available can set a Vercel environment
variable, so this is the one manual step.

## What ships without doing anything

`/profile/settings` shows a "Reminders" card and lets you turn notifications
on for a device. That subscription gets saved to `t4m_push_subscription`
either way. Nothing sends until the steps below are done — the send call
(`src/server/push.ts`) fails fast with a clear error rather than pretending
to have worked.

## Step 1 — generate a VAPID keypair

This is a self-issued keypair, not a credential from any third-party
account — nothing to sign up for.

```bash
npx web-push generate-vapid-keys
```

The **public** key printed must match the one already hardcoded in
`src/core/push.ts` (`VAPID_PUBLIC_KEY`) — it's meant to be public, so it's
checked into the repo the same way the Supabase publishable key is. If you
regenerate a keypair, update that constant to match the new public key.

The **private** key must never go in the repository. Copy it for step 2 only.

## Step 2 — set two environment variables in Vercel

Vercel dashboard → **training4me** project → **Settings → Environment
Variables**, both for **Production**:

- `VAPID_PRIVATE_KEY` — the private key from step 1.
- `CRON_SECRET` — any long random string (`openssl rand -hex 32` works).
  Vercel Cron attaches this automatically as
  `Authorization: Bearer <value>` on every scheduled request; the cron
  route (`src/app/api/cron/reminders/route.ts`) checks it and refuses to
  run without it, the same way production refuses to serve at all without
  `APP_PIN`.

Redeploy — both are read at request time, not build time, but a redeploy is
the simplest way to be sure the running instance has picked them up.

## Step 3 — confirm it's live

1. Open `/profile/settings` on your phone, turn reminders on, allow the
   browser permission prompt.
2. From your machine, fire a cron check manually to prove the whole path
   end to end (replace `<CRON_SECRET>`):

   ```bash
   curl -H "Authorization: Bearer <CRON_SECRET>" \
     "https://training4me.vercel.app/api/cron/reminders?kind=session-day"
   ```

   `{"kind":"session-day","result":null}` means it ran fine and there was
   nothing due today (no active program, or no session scheduled today).
   `{"kind":"session-day","result":{"sent":1,"total":1}}` means it sent.

## The schedule

`vercel.json`'s `crons` array fires two checks daily, both fixed UTC times
(Vercel Cron has no per-timezone scheduling): `session-day` at 06:00 UTC
(≈7–8am Stockholm depending on DST) and `overnight-nudge` at 22:00 UTC
(≈23:00–midnight Stockholm). Close enough for one real athlete in one real
timezone; revisit if either drifts noticeably wrong across a DST change.

Hobby-plan Vercel projects cap a cron entry at once a day — both triggers
already fit that without needing Pro.
