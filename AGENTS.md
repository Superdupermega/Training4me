# Agent instructions

This is a single-maintainer, personal project — no reviewers, no PR queue
(the repo has never had a merged pull request). Optimise for "shipped and
correct," not for a review process that doesn't exist.

## Push straight to `main` when a task is done

Do the work on whatever branch your task setup gives you, but the finished,
validated result belongs on `main` — that's the branch the maintainer reads
from and the one wired to deploy (see "Deploys" below). Don't leave completed
work stranded on a `claude/...` task branch waiting for a PR that will never
come. When you're done:

1. Make sure `main` is your base — `git fetch origin main` and build on top
   of its actual tip, not an older branch. This repo has had stale, diverged
   task branches sit around before (one, at one point, was even GitHub's
   reported "default branch" while `main` had 17 commits it didn't) —
   always verify against `origin/main` directly rather than trusting
   whatever branch a tool reports as default.
2. Validate before pushing — see below.
3. Push (or merge/fast-forward) directly to `main`. Do not wait for approval
   to merge your own branch into `main`; that approval is what "the task is
   done" already means here.

## Validate before every push to `main`

```
pnpm lint && pnpm typecheck && pnpm test
```

All three must be clean. A bad push to `main` goes live (see below), so this
is not optional. `pnpm build` is worth running too for anything touching
routing, metadata, or env-var handling.

## Deploys

Every push to `main` is what should reach `training4me.vercel.app` — confirm
this is actually how the Vercel project is wired (Project Settings →
Git → Production Branch) before relying on it silently; it does not
self-heal if it drifts. Because a push can go live immediately, prefer
pushes that are validated and complete over frequent small ones — don't
push a half-finished change to `main` and plan to fix it forward.

## Where to look first

- `README.md` — setup, environment, how the app is structured.
- `docs/03-ARCHITECTURE.md` — the one rule that matters (`src/core` stays
  pure), data flow, module map.
- `docs/DECISIONS.md` — why things are the way they are, especially where a
  doc and the code have ever diverged.
- `docs/07-PRODUCTION-REVIEW.md`, `docs/06-REDESIGN-PLAN.md` — the two most
  recent large passes over this app; skim their "Status"/intro before
  assuming something is still an open problem.
