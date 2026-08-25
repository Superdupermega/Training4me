import type { PlannedSession, Readiness } from '../types';
import { fitToBudget } from '../timeBudget';
import { roundToIncrement } from './waves';

export interface ReadinessEffect {
  score: number;
  loadMultiplier: number;
  message: string;
  changes: string[];
}

export function readinessScore(r: Readiness): number {
  return r.sleep + r.soreness + r.stress;
}

// Each of the three sliders defaults to its own midpoint (3), so an untouched
// dialog scores 9. That has to land on "normal" — otherwise skipping the
// question outright beats answering it honestly, which defeats the point of
// asking at all.
export function readinessBand(score: number): ReadinessEffect {
  if (score >= 13) return { score, loadMultiplier: 1, message: 'Green light. Go get it.', changes: [] };
  if (score >= 9) return { score, loadMultiplier: 1, message: 'Normal day. Stick to the plan.', changes: [] };
  if (score >= 6) return { score, loadMultiplier: 0.93, message: 'Back off a touch. Still worth doing.', changes: [] };
  return { score, loadMultiplier: 0.85, message: 'Low battery. Move well, get out.', changes: [] };
}

/**
 * Readiness never changes which movements you do — only how heavy and how much.
 */
export function applyReadiness(
  session: PlannedSession,
  readiness: Readiness,
  capSec: number,
  paceFactor = 1,
): { session: PlannedSession; effect: ReadinessEffect } {
  const effect = readinessBand(readinessScore(readiness));
  if (effect.loadMultiplier === 1) return { session, effect };

  const changes: string[] = [];
  let blocks = session.blocks.map((block) => {
    if (block.kind !== 'main') return block;
    return {
      ...block,
      exercises: block.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) =>
          s.weightKg
            ? { ...s, weightKg: roundToIncrement(s.weightKg * effect.loadMultiplier, 2.5) }
            : s,
        ),
      })),
    };
  });
  changes.push(`Main lift trimmed to ${Math.round(effect.loadMultiplier * 100)}%`);

  if (effect.score < 10) {
    blocks = blocks.map((block) =>
      block.kind === 'secondary' && (block.exercises[0]?.sets.length ?? 0) > 2
        ? { ...block, exercises: block.exercises.map((e) => ({ ...e, sets: e.sets.slice(0, -1) })) }
        : block,
    );
    changes.push('One secondary set dropped');
  }

  if (effect.score < 7) {
    blocks = blocks.filter((b) => b.kind !== 'superset');
    changes.push('Accessory block skipped');
  }

  const adjusted = fitToBudget({ ...session, blocks }, capSec, paceFactor);
  return { session: adjusted, effect: { ...effect, changes } };
}
