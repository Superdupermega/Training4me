import { getExercise } from '../library/exercises';
import { find, pick, preferred, type LibraryContext } from '../library/query';
import { prescriptionFor, waveFor } from '../progression/waves';
import { resolveTrainingMax } from '../progression/trainingMax';
import { fitToBudget } from '../timeBudget';
import type { MovementPattern, PlannedSession, PlannedWeek, PrescribedSet, SessionBlock } from '../types';
import type { GenContext } from './context';

/**
 * A mesocycle keeps the same movements from week to week — that is what makes
 * progression legible. Only the wave (sets, reps, load) and the finisher
 * rotation change. So later weeks are re-materialised from week one rather
 * than re-selected, which also keeps the whole block deterministic.
 */
export function rematerializeWeek(
  templateWeek: PlannedWeek,
  weekNumber: number,
  weeks: 4 | 6,
  dateFor: (weekNumber: number, weekday: number) => string,
  ctx: GenContext,
  lib: LibraryContext,
  rng: () => number,
): PlannedWeek {
  const wave = waveFor(weeks)[weekNumber - 1]!;
  const isDeload = wave.isDeload;

  const sessions = templateWeek.sessions.map((template): PlannedSession => {
    const blocks: SessionBlock[] = [];

    for (const block of template.blocks) {
      if (block.kind === 'primer' || block.kind === 'downregulate') {
        blocks.push(block);
        continue;
      }

      if (block.kind === 'main') {
        const be = block.exercises[0]!;
        const ex = getExercise(be.exerciseId);
        const tm = resolveTrainingMax(ex.id, ex.pattern, ctx.trainingMaxes);
        blocks.push({
          ...block,
          exercises: [{ ...be, sets: prescriptionFor({ weeks, week: weekNumber, trainingMaxKg: tm, increment: ctx.increment }) }],
        });
        continue;
      }

      if (block.kind === 'secondary') {
        const count = isDeload ? 2 : 3;
        blocks.push({
          ...block,
          exercises: block.exercises.map((be) => ({ ...be, sets: resize(be.sets, count) })),
        });
        continue;
      }

      if (block.kind === 'superset') {
        // Accessory volume comes down as intensity climbs — on the peak week
        // the main lift takes the time and the recovery.
        const rounds = isDeload || wave.top ? 2 : (block.rounds ?? 3);
        blocks.push({
          ...block,
          rounds,
          exercises: block.exercises.map((be) => ({ ...be, sets: resize(be.sets, rounds) })),
        });
        continue;
      }

      if (block.kind === 'finisher') {
        if (isDeload && template.mainPattern) continue;
        // The aerobic day's Zone 2 piece is the point of that day — never rotate it.
        if (!template.mainPattern) { blocks.push(block); continue; }
        blocks.push(rotateFinisher(block, weekNumber, template.dayNumber, lib, rng, ctx));
        continue;
      }

      blocks.push(block);
    }

    const session: PlannedSession = {
      ...template,
      weekNumber,
      date: dateFor(weekNumber, template.weekday),
      isDeload,
      blocks,
      estimatedSec: 0,
      trimLog: [],
    };
    return fitToBudget(session, ctx.sessionCapSec, ctx.paceFactor);
  });

  return { weekNumber, isDeload, sessions: isDeload ? sessions : ensureCarry(sessions, lib, ctx, rng) };
}

/** Grip and trunk are training, not filler — every real week gets a carry. */
function ensureCarry(
  sessions: PlannedSession[],
  lib: LibraryContext,
  ctx: GenContext,
  rng: () => number,
): PlannedSession[] {
  const hasCarry = sessions.some((s) =>
    s.blocks.some((b) => b.exercises.some((e) => getExercise(e.exerciseId).pattern === 'carry')),
  );
  if (hasCarry) return sessions;

  const targetIndex = sessions.findIndex(
    (s) => s.mainPattern && s.blocks.some((b) => b.kind === 'finisher'),
  );
  if (targetIndex < 0) return sessions;
  const carry = pick(preferred(find(lib, { pattern: 'carry', tier: 'T4' }), ctx.equipment), rng);
  if (!carry) return sessions;

  return sessions.map((s, i) => {
    if (i !== targetIndex) return s;
    const blocks = s.blocks.map((b) =>
      b.kind !== 'finisher' ? b : {
        ...b,
        name: 'Carry',
        exercises: [{
          slot: b.exercises[0]?.slot ?? 'E', exerciseId: carry.id, tempo: carry.defaultTempo, cue: carry.cue,
          sets: Array.from({ length: 4 }, (_, k) => ({
            setNumber: k + 1, kind: 'working' as const, distanceM: 30, restSec: 60, estimatedSec: 0,
          })),
        }],
      });
    return fitToBudget({ ...s, blocks }, ctx.sessionCapSec, ctx.paceFactor);
  });
}

function resize(sets: PrescribedSet[], count: number): PrescribedSet[] {
  const base = sets[0];
  if (!base) return sets;
  return Array.from({ length: count }, (_, i) => ({ ...(sets[i] ?? base), setNumber: i + 1 }));
}

/** Carry, trunk, easy aerobic, carry — grip and trunk get a double serving. */
function rotateFinisher(
  block: SessionBlock,
  weekNumber: number,
  dayNumber: number,
  lib: LibraryContext,
  rng: () => number,
  ctx: GenContext,
): SessionBlock {
  const order: MovementPattern[] = ['carry', 'trunk', 'aerobic', 'carry'];
  const wanted = order[(weekNumber - 1 + dayNumber - 1) % 4]!;
  const current = getExercise(block.exercises[0]!.exerciseId);
  if (current.pattern === wanted) return block;

  const ex = pick(preferred(find(lib, { pattern: wanted, tier: 'T4' }), ctx.equipment), rng);
  if (!ex) return block;

  const sets: PrescribedSet[] =
    ex.metric === 'distance'
      ? Array.from({ length: 4 }, (_, i) => ({ setNumber: i + 1, kind: 'working' as const, distanceM: 30, restSec: 60, estimatedSec: 0 }))
      : ex.metric === 'duration'
        ? [{ setNumber: 1, kind: 'working' as const, durationSec: wanted === 'aerobic' ? 420 : 45, perSide: ex.unilateral, restSec: 30, estimatedSec: 0 }]
        : Array.from({ length: 3 }, (_, i) => ({ setNumber: i + 1, kind: 'working' as const, reps: ex.repHi, perSide: ex.unilateral, restSec: 45, estimatedSec: 0 }));

  return {
    ...block,
    name: wanted === 'carry' ? 'Carry' : wanted === 'aerobic' ? 'Easy aerobic' : 'Trunk',
    exercises: [{
      slot: block.exercises[0]?.slot ?? 'E',
      exerciseId: ex.id, tempo: ex.defaultTempo, cue: ex.cue, sets,
    }],
  };
}
