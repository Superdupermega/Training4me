'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { buildCoachContext, type CoachContextPr } from '@/core/coach/context';
import { requireUnlocked } from '../authGuard';
import * as repo from '../repo';
import { TAGS } from '../repo';
import { coachCompletion } from './anthropic';
import { isCoachConfigured } from './config';
import * as coachRepo from './repo';
import type { Result } from './result';

/**
 * The coach's one action this chunk — a read-only chat turn, no tool use
 * (`docs/11-COACH-PLATFORM.md §0`: chunk 28 adds `propose_change`).
 * `requireUnlocked()` first, always, same isolation story as every action
 * in the top-level `actions.ts` (`00-CONTEXT.md §5`, `authGuard.ts`) — this
 * module is never imported by `src/app/unlock/page.tsx` or anything it
 * renders, so `scripts/check-action-isolation.mjs` never sees it either.
 */

const SYSTEM_PROMPT = `You are the training coach inside Training4me, a personal
strength-training app built for one athlete. Everything you are told about
their training below came straight out of their own log — never invent a
number, a lift, a session, or a training max that isn't given to you. If you
don't have what you need to answer something, say so plainly instead of
guessing.

The app's own philosophy, which your advice should agree with: a heavy
barbell base (squat, hinge, press, row, chin) done heavy but submaximal and
repeatable, wrapped in a warm-up primer, tempo-controlled and unilateral
accessory work, and an aerobic base — so the athlete gets genuinely strong
without getting stiff or hurt. Reps in reserve, not grinding to failure.
Progress is measured over months, not sessions.

Answer like a training partner who has actually read the log: plain,
specific, brief — a paragraph at most, not an essay.`;

/** The week the athlete is actually in right now — same rule `/today` uses: the week of the oldest not-done session, else the last week if the block is finished. */
function thisWeeksSessions(sessions: repo.SessionRow[]): repo.SessionRow[] {
  const featured = sessions.find((s) => s.status === 'planned' || s.status === 'in_progress');
  const currentWeek = featured?.weekNumber
    ?? (sessions.length ? Math.max(...sessions.map((s) => s.weekNumber)) : 1);
  return sessions.filter((s) => s.weekNumber === currentWeek);
}

export async function sendCoachMessage(text: string): Promise<Result<{ replyId: string }>> {
  try {
    await requireUnlocked();
    // Defensive, same as every coach surface — an action is a public
    // endpoint regardless of what the nav/`/coach` UI shows
    // (`docs/11-COACH-PLATFORM.md §6.1`).
    if (!isCoachConfigured()) return { ok: false, error: 'Coach is not configured.' };

    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: 'Message is empty.' };

    // Saved before the model is ever called — a refused/failed reply below
    // still keeps the athlete's own side of the exchange.
    await coachRepo.insertCoachMessage({ role: 'user', kind: 'chat', content: trimmed });
    revalidateTag(TAGS.coach);

    const profile = await repo.getProfile();
    const [activeProgram, prs, history] = await Promise.all([
      repo.getActiveProgram(), repo.listPRs(), coachRepo.listCoachMessages(),
    ]);
    const sessions = activeProgram ? await repo.listSessions(activeProgram.id) : [];

    const context = buildCoachContext({
      profile: { daysPerWeek: profile.daysPerWeek, mesocycleWeeks: profile.mesocycleWeeks },
      activeProgram: activeProgram
        ? {
            name: activeProgram.name, weeks: activeProgram.weeks, daysPerWeek: activeProgram.daysPerWeek,
            trainingMaxes: activeProgram.input.trainingMaxes,
          }
        : null,
      thisWeekSessions: thisWeeksSessions(sessions).map((s) => ({ weekNumber: s.weekNumber, status: s.status })),
      // Most recent 3–5, per docs/11-COACH-PLATFORM.md §4.
      recentPrs: prs.slice(0, 5).map((p): CoachContextPr => ({
        exerciseId: p.exercise_id, kind: p.kind as CoachContextPr['kind'], value: Number(p.value),
        reps: p.reps, weightKg: p.weight_kg != null ? Number(p.weight_kg) : null, achievedAt: p.achieved_at,
      })),
    });

    // `history` already includes the user message just inserted above —
    // `revalidateTag` took effect before this read, same pattern
    // `actions.ts`'s `logSets` already relies on (write → revalidateTag →
    // read the same tag, same request) — so there is nothing to append here.
    const result = await coachCompletion({
      kind: 'chat',
      system: `${SYSTEM_PROMPT}\n\nFacts about this athlete, as of right now:\n${context}`,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      timezone: profile.timezone,
    });
    if (!result.ok) return result;
    // `coachCompletion` always sets `data` on an `ok: true` result; the
    // `Result<T>` contract's `data?: T` just doesn't say so in the type.
    if (!result.data) return { ok: false, error: 'Coach returned no reply.' };

    const reply = await coachRepo.insertCoachMessage({
      role: 'assistant', kind: 'chat', content: result.data.text,
    });
    revalidateTag(TAGS.coach);
    revalidatePath('/coach');
    return { ok: true, data: { replyId: reply.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong';
    return { ok: false, error: message };
  }
}
