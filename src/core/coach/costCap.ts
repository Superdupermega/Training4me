/**
 * Pure. `src/server/coach/anthropic.ts` calls this before every real
 * Anthropic request, with the two summed totals `src/server/coach/repo.ts`
 * computes and the two env-configured caps (defaulted in
 * `src/server/coach/config.ts`) — the caps are enforced, not advisory
 * (`docs/11-COACH-PLATFORM.md §2`).
 *
 * Boundary rule, decided and documented here since the chunk brief asked for
 * one: spending **exactly** the cap still allows the *next* call — only
 * spending **strictly over** it refuses. So a $2.00 daily cap with exactly
 * $2.00 already spent today still allows one more call; $2.01 spent refuses.
 * This mirrors how a real budget is usually read ("up to $2/day"), and keeps
 * the check symmetric with the two caps' own defaults being round numbers a
 * single call is unlikely to land exactly on anyway.
 */
export function capCheck(
  spentTodayUsd: number,
  spentThisMonthUsd: number,
  dailyCapUsd: number,
  monthlyCapUsd: number,
): { allowed: boolean; reason?: 'daily' | 'monthly' } {
  if (spentTodayUsd > dailyCapUsd) return { allowed: false, reason: 'daily' };
  if (spentThisMonthUsd > monthlyCapUsd) return { allowed: false, reason: 'monthly' };
  return { allowed: true };
}
