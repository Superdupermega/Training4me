#!/usr/bin/env node
// Regression guard for docs/07-PRODUCTION-REVIEW.md #1: the PIN-gate bypass
// where /unlock, by importing `unlock` from a module shared with every other
// server action, ended up listing every mutation as one of its own callable
// workers — and middleware.ts deliberately excludes /unlock from the lock.
//
// Runs after `next build`, against its own build output. Fails the build if
// any server action other than `unlock` itself lists `app/unlock/page` among
// its workers — the exact shape of the bug this guards against.
import { readFile } from 'node:fs/promises';

const MANIFEST_PATH = '.next/server/server-reference-manifest.json';
const UNLOCK_WORKER = 'app/unlock/page';

const raw = await readFile(MANIFEST_PATH, 'utf8').catch((err) => {
  console.error(`check-action-isolation: could not read ${MANIFEST_PATH} — run "next build" first.`);
  throw err;
});
const manifest = JSON.parse(raw);

// For any action whose worker list includes app/unlock/page, that action
// should be exactly the one exported from src/server/unlockAction.ts. Export
// names aren't reliably recoverable from the manifest across Next versions,
// so the guard is structural instead: app/unlock/page must not appear as a
// worker for more than one action ID (the one for `unlock` itself). More
// than one is proof unlock/page.tsx — or a component it renders — is
// importing a shared action module again.
const actionsExposingUnlockPage = [];
for (const runtime of ['node', 'edge']) {
  for (const [actionId, info] of Object.entries(manifest[runtime] ?? {})) {
    if (Object.keys(info.workers ?? {}).includes(UNLOCK_WORKER)) {
      actionsExposingUnlockPage.push(actionId);
    }
  }
}

if (actionsExposingUnlockPage.length === 0) {
  console.error(
    'check-action-isolation: FAILED — no server action lists app/unlock/page as a worker at ' +
    'all, which means /unlock has no way to call `unlock` either. The build output shape ' +
    'this script expects may have changed; check server-reference-manifest.json by hand.',
  );
  process.exitCode = 1;
} else if (actionsExposingUnlockPage.length > 1) {
  console.error(
    `check-action-isolation: FAILED — ${actionsExposingUnlockPage.length} server actions are ` +
    `reachable from /unlock (expected exactly 1, the "unlock" action itself):\n` +
    actionsExposingUnlockPage.map((id) => `  - ${id}`).join('\n') +
    `\n\nThis is the shape of docs/07-PRODUCTION-REVIEW.md #1: /unlock (which middleware.ts ` +
    `deliberately never gates) is importing a server-action module shared with other, ` +
    `mutating actions. Check what src/app/unlock/page.tsx imports, directly or through a ` +
    `component it renders — it must only ever import from src/server/unlockAction.ts.`,
  );
  process.exitCode = 1;
} else {
  console.log('check-action-isolation: OK — only the unlock action is reachable from /unlock.');
}
