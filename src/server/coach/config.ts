import 'server-only';

/**
 * The one gate every coach surface and every coach action checks — one call
 * site rather than `process.env.ANTHROPIC_API_KEY` read in a dozen places.
 * Same shape as `VAPID_PRIVATE_KEY`/`APP_PIN`: absence is a supported state,
 * not an error state (`docs/11-COACH-PLATFORM.md §1`).
 */
export function isCoachConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * `docs/11-COACH-PLATFORM.md §1`: these two have defaults and don't need
 * setting; `ANTHROPIC_API_KEY` has none. Read as functions, not constants
 * evaluated at module load, so a test can flip `process.env` and see the
 * change (same pattern as `db.ts`'s `resolveKey`).
 */
export function dailyCapUsd(): number {
  const raw = Number(process.env.COACH_DAILY_CAP_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}

export function monthlyCapUsd(): number {
  const raw = Number(process.env.COACH_MONTHLY_CAP_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}
