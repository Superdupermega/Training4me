import { getExercise } from '../library/exercises';
import { find, pick, preferred, substitute, type LibraryContext } from '../library/query';
import { prescriptionFor, waveFor } from '../progression/waves';
import { resolveTrainingMax } from '../progression/trainingMax';
import { fitToBudget } from '../timeBudget';
import type {
  BlockExercise, Exercise, MovementPattern, PlannedSession, PrescribedSet,
  SessionArchetype, SessionBlock, Tier,
} from '../types';
import { DomainError } from '../types';
import { recordUse, setsFor, overusedIds, type GenContext, type WeekState } from './context';
import type { SkeletonDay } from './split';

// ------------------------------------------------------------------ primers

const PRIMERS: Record<string, string[]> = {
  lower: ['bike-z2', 'goblet-squat', 'hip-90-90', 'glute-bridge'],
  upper: ['row-z2', 'band-pull-apart', 'shoulder-car', 'scap-push-up'],
  full: ['bike-z2', 'goblet-squat', 'band-pull-apart', 'worlds-greatest-stretch'],
  aerobic: ['brisk-walk', 'hip-airplane', 'cat-cow'],
};

const PRIMER_FOR: Record<SessionArchetype, keyof typeof PRIMERS> = {
  'FB-A': 'full', 'FB-B': 'full', 'FB-C': 'full',
  'LOWER-SQ': 'lower', 'LOWER-HINGE': 'lower',
  'UPPER-PUSH': 'upper', 'UPPER-PULL': 'upper',
  'AEROBIC-MOBILITY': 'aerobic', 'PUMP-BALANCE': 'upper',
};

/** Which pattern the day's secondary lift comes from — chosen to balance the week. */
const T2_PATTERN: Record<SessionArchetype, MovementPattern[]> = {
  'FB-A': ['push_h'],
  'FB-B': ['lunge'],
  'FB-C': ['pull_h'],
  'LOWER-SQ': ['lunge'],
  'LOWER-HINGE': ['lunge', 'squat'],
  // A horizontal main press pairs with a vertical secondary: the vertical
  // press then lives in a slot that never gets trimmed away.
  'UPPER-PUSH': ['push_v'],
  'UPPER-PULL': ['push_h'],
  'AEROBIC-MOBILITY': [],
  'PUMP-BALANCE': [],
};

const TITLES: Record<SessionArchetype, string> = {
  'FB-A': 'Squat day', 'FB-B': 'Press day', 'FB-C': 'Hinge day',
  'LOWER-SQ': 'Lower — squat', 'LOWER-HINGE': 'Lower — hinge',
  'UPPER-PUSH': 'Upper — push', 'UPPER-PULL': 'Upper — pull',
  'AEROBIC-MOBILITY': 'Aerobic + mobility', 'PUMP-BALANCE': 'Balance + pump',
};

// ------------------------------------------------------------------ helpers

function libCtx(ctx: GenContext): LibraryContext {
  return { equipment: ctx.equipment, painFlags: ctx.painFlags, allowAdvanced: ctx.allowAdvanced };
}

function resolveOrSubstitute(id: string, ctx: GenContext): Exercise {
  const lib = libCtx(ctx);
  const ex = getExercise(id);
  const available = find(lib, { pattern: ex.pattern }).some((c) => c.id === ex.id);
  return available ? ex : substitute(ex, lib);
}

function repSet(reps: number, restSec: number, perSide = false, rpe?: number): PrescribedSet {
  return { setNumber: 1, kind: 'working', reps, perSide, restSec, rpe, estimatedSec: 0 };
}

function blockExercise(slot: string, ex: Exercise, sets: PrescribedSet[], tempo?: string): BlockExercise {
  return {
    slot,
    exerciseId: ex.id,
    tempo: tempo ?? ex.defaultTempo,
    cue: ex.cue,
    sets: sets.map((s, i) => ({ ...s, setNumber: i + 1 })),
  };
}

function buildPrimer(archetype: SessionArchetype, ctx: GenContext): SessionBlock {
  const recipe = PRIMERS[PRIMER_FOR[archetype]] ?? PRIMERS.full!;
  const exercises = recipe.map((id, i) => {
    const ex = resolveOrSubstitute(id, ctx);
    const set: PrescribedSet =
      ex.metric === 'duration' || ex.pattern === 'aerobic'
        ? { setNumber: 1, kind: 'working', durationSec: 60, restSec: 0, estimatedSec: 0 }
        : repSet(ex.unilateral ? 6 : 10, i === recipe.length - 1 ? 30 : 0, ex.unilateral);
    return blockExercise(`A${i + 1}`, ex, [set], '2010');
  });
  return { letter: 'A', kind: 'primer', name: 'Primer', rounds: 2, exercises, estimatedSec: 0,
    note: 'Easy. Get warm and present — this is not training yet.' };
}

function buildDownregulate(archetype: SessionArchetype, ctx: GenContext): SessionBlock {
  const lowerDay = ['FB-A', 'FB-C', 'LOWER-SQ', 'LOWER-HINGE'].includes(archetype);
  const stretch = resolveOrSubstitute(lowerDay ? 'couch-stretch' : 'doorway-pec-stretch', ctx);
  return {
    letter: 'F', kind: 'downregulate', name: 'Down-regulate',
    note: 'Eight nasal breaths, four in and eight out, then the stretch.',
    exercises: [
      blockExercise('F1', stretch, [
        { setNumber: 1, kind: 'working', durationSec: 45, perSide: stretch.unilateral, restSec: 0, estimatedSec: 0 },
      ], '2010'),
    ],
    estimatedSec: 0,
  };
}

// ------------------------------------------------------------------ selection

function pickT1(day: SkeletonDay, ctx: GenContext, state: WeekState, rng: () => number): Exercise {
  const lib = libCtx(ctx);
  const pattern = day.mainPattern!;
  const exclude = overusedIds(state);

  const known = find(lib, { pattern, tier: 'T1', exclude }).filter((e) => ctx.trainingMaxes[e.id]);
  const t1 = preferred(find(lib, { pattern, tier: 'T1', exclude }), ctx.equipment);
  const fallbackPattern: MovementPattern | null =
    pattern === 'pull_v' ? 'pull_h' : pattern === 'push_v' ? 'push_h' : null;

  const chosen =
    known[0] ??
    pick(t1, rng) ??
    (fallbackPattern ? pick(preferred(find(lib, { pattern: fallbackPattern, tier: 'T1', exclude }), ctx.equipment), rng) : null) ??
    pick(preferred(find(lib, { pattern, tier: 'T2', loadable: true, exclude }), ctx.equipment), rng) ??
    pick(preferred(find(lib, { pattern, tier: ['T2', 'T3'], exclude }), ctx.equipment), rng);

  if (!chosen) {
    throw new DomainError('NO_MAIN_LIFT', `No main lift available for ${pattern}`, { pattern });
  }
  return chosen;
}

function pickT2(day: SkeletonDay, t1: Exercise, ctx: GenContext, state: WeekState, rng: () => number): Exercise {
  const lib = libCtx(ctx);
  const exclude = [...overusedIds(state), t1.id];
  for (const pattern of T2_PATTERN[day.archetype]) {
    // Prefer a unilateral option while the week still lacks one.
    const wantUni =
      (['squat', 'hinge', 'lunge'].includes(pattern) && !state.hasUnilateralLower) ||
      (['push_h', 'push_v', 'pull_h', 'pull_v'].includes(pattern) && !state.hasUnilateralUpper);
    const uni = wantUni
      ? preferred(find(lib, { pattern, tier: 'T2', unilateral: true, exclude }), ctx.equipment)
      : [];
    const chosen = pick(uni, rng) ?? pick(preferred(find(lib, { pattern, tier: 'T2', exclude }), ctx.equipment), rng)
      ?? pick(preferred(find(lib, { pattern, tier: ['T2', 'T3'], exclude }), ctx.equipment), rng);
    if (chosen) return chosen;
  }
  const any = pick(preferred(find(lib, { tier: 'T2', exclude }), ctx.equipment), rng);
  if (!any) throw new DomainError('NO_SECONDARY', 'No secondary lift available', { archetype: day.archetype });
  return any;
}

const UPPER_PATTERNS: MovementPattern[] = ['push_h', 'push_v', 'pull_h', 'pull_v', 'isolation_upper'];

/** The accessory pair exists to close whatever the week is short of. */
function pickT3Pair(ctx: GenContext, state: WeekState, rng: () => number): [Exercise, Exercise, boolean] {
  const lib = libCtx(ctx);
  const exclude = overusedIds(state);
  const pull = setsFor(state, 'pull_h', 'pull_v');
  const push = setsFor(state, 'push_h', 'push_v');

  let d1: Exercise | null = null;
  if (pull <= push) {
    const pattern: MovementPattern = !state.hasPullV ? 'pull_v' : 'pull_h';
    d1 = pick(preferred(find(lib, { pattern, tier: ['T2', 'T3'], exclude }), ctx.equipment), rng)
      ?? pick(preferred(find(lib, { pattern: 'pull_h', tier: ['T2', 'T3'], exclude }), ctx.equipment), rng);
  } else {
    const pattern: MovementPattern = !state.hasPushV ? 'push_v' : 'push_h';
    d1 = pick(preferred(find(lib, { pattern, tier: ['T2', 'T3'], exclude }), ctx.equipment), rng)
      ?? pick(preferred(find(lib, { pattern: 'push_h', tier: ['T2', 'T3'], exclude }), ctx.equipment), rng);
  }
  if (!d1) d1 = pick(preferred(find(lib, { tier: 'T3', exclude }), ctx.equipment), rng);
  if (!d1) throw new DomainError('NO_ACCESSORY', 'No accessory movement available', {});

  const d1IsUpper = UPPER_PATTERNS.includes(d1.pattern);
  const exclude2 = [...exclude, d1.id];
  const rounds = 3;
  const pullAfter = pull + (['pull_h', 'pull_v'].includes(d1.pattern) ? rounds : 0);
  const pushAfter = push + (['push_h', 'push_v'].includes(d1.pattern) ? rounds : 0);
  let d2: Exercise | null = null;

  // 1. The week must contain unilateral work on both halves of the body.
  if (!state.hasUnilateralLower) {
    d2 = pick(preferred(find(lib, { pattern: ['lunge', 'isolation_lower'], tier: ['T2', 'T3'], unilateral: true, exclude: exclude2 }), ctx.equipment), rng);
  }
  if (!d2 && !state.hasUnilateralUpper) {
    d2 = pick(preferred(find(lib, {
      pattern: (['pull_h', 'push_v', 'push_h', 'isolation_upper'] as MovementPattern[]).filter((p) => p !== d1.pattern),
      tier: ['T2', 'T3'], unilateral: true, exclude: exclude2,
    }), ctx.equipment), rng);
  }
  // 2. Then use the slot to close whatever push/pull gap D1 left behind.
  let d2Structural = false;
  if (!d2 && pullAfter < pushAfter && d1.pattern !== 'pull_h') {
    d2 = pick(preferred(find(lib, { pattern: 'pull_h', tier: 'T3', exclude: exclude2 }), ctx.equipment), rng);
    d2Structural = d2 != null;
  }
  if (!d2 && pushAfter * 1.45 < pullAfter && !['push_h', 'push_v'].includes(d1.pattern)) {
    d2 = pick(preferred(find(lib, { pattern: ['push_h', 'push_v'], tier: ['T2', 'T3'], exclude: exclude2 }), ctx.equipment), rng);
    d2Structural = d2 != null;
  }
  // 3. Otherwise pair the opposite half of the body, so nothing competes.
  if (!d2) {
    const pattern: MovementPattern[] = d1IsUpper ? ['isolation_lower', 'lunge'] : ['isolation_upper'];
    d2 = pick(preferred(find(lib, { pattern, tier: 'T3', exclude: exclude2 }), ctx.equipment), rng)
      ?? pick(preferred(find(lib, { pattern, tier: ['T2', 'T3'], exclude: exclude2 }), ctx.equipment), rng);
  }
  if (!d2) d2 = pick(preferred(find(lib, { pattern: ['trunk'], tier: 'T4', exclude: exclude2 }), ctx.equipment), rng);
  if (!d2) throw new DomainError('NO_ACCESSORY', 'No second accessory available', {});
  return [d1, d2, d2Structural];
}

/** Carry, trunk, aerobic, carry — so grip and trunk never get skipped. */
function pickFinisher(weekNumber: number, ctx: GenContext, state: WeekState, rng: () => number): SessionBlock | null {
  const lib = libCtx(ctx);
  const order: MovementPattern[] = ['carry', 'trunk', 'aerobic', 'carry'];
  const wanted = order[(weekNumber - 1) % 4]!;
  const patterns: MovementPattern[] = state.hasCarry ? [wanted] : ['carry', wanted];

  for (const pattern of patterns) {
    const ex = pick(preferred(find(lib, { pattern, tier: 'T4', exclude: overusedIds(state) }), ctx.equipment), rng);
    if (!ex) continue;
    const sets: PrescribedSet[] =
      ex.metric === 'distance'
        ? Array.from({ length: 4 }, () => ({ setNumber: 1, kind: 'working' as const, distanceM: 30, restSec: 60, estimatedSec: 0 }))
        : ex.metric === 'duration'
          ? [{ setNumber: 1, kind: 'working', durationSec: pattern === 'aerobic' ? 420 : 45, perSide: ex.unilateral, restSec: 30, estimatedSec: 0 }]
          : Array.from({ length: 3 }, () => repSet(ex.repHi, 45, ex.unilateral));
    return {
      letter: 'E', kind: 'finisher', name: pattern === 'carry' ? 'Carry' : pattern === 'aerobic' ? 'Easy aerobic' : 'Trunk',
      exercises: [blockExercise('E', ex, sets)], estimatedSec: 0,
    };
  }
  return null;
}

// ------------------------------------------------------------------ assembly

export interface AssembleArgs {
  day: SkeletonDay;
  weekNumber: number;
  weeks: 4 | 6;
  date: string;
  ctx: GenContext;
  state: WeekState;
  rng: () => number;
}

function assembleSpecial(args: AssembleArgs): PlannedSession {
  const { day, ctx, state, rng } = args;
  const lib = libCtx(ctx);
  const blocks: SessionBlock[] = [buildPrimer(day.archetype, ctx)];

  if (day.archetype === 'AEROBIC-MOBILITY') {
    const aerobic = pick(preferred(find(lib, { pattern: 'aerobic' }), ctx.equipment), rng)!;
    blocks.push({
      letter: 'B', kind: 'finisher', name: 'Zone 2',
      note: 'Nasal breathing the whole way. If you cannot hold a conversation, slow down.',
      exercises: [blockExercise('B', aerobic, [{ setNumber: 1, kind: 'working', durationSec: 1500, restSec: 0, estimatedSec: 0 }])],
      estimatedSec: 0,
    });
    const mob = find(lib, { pattern: 'mobility' }).slice(0, 3);
    blocks.push({
      letter: 'C', kind: 'superset', name: 'Mobility circuit', rounds: 2,
      exercises: mob.map((ex, i) => blockExercise(`C${i + 1}`, ex, [repSet(ex.repHi, i === mob.length - 1 ? 30 : 0, ex.unilateral)], '3030')),
      estimatedSec: 0,
    });
    const carry = pick(preferred(find(lib, { pattern: 'carry' }), ctx.equipment), rng);
    if (carry) {
      recordUse(state, carry, 0);
      blocks.push({
        letter: 'D', kind: 'finisher', name: 'Carry',
        exercises: [blockExercise('D', carry, Array.from({ length: 3 }, () => ({ setNumber: 1, kind: 'working' as const, distanceM: 30, restSec: 60, estimatedSec: 0 })))],
        estimatedSec: 0,
      });
    }
  } else {
    // PUMP-BALANCE: two accessory supersets, nothing on the spine.
    for (let i = 0; i < 2; i += 1) {
      const [a, b] = pickT3Pair(ctx, state, rng);
      recordUse(state, a, 3);
      recordUse(state, b, 3);
      blocks.push({
        letter: String.fromCharCode(66 + i), kind: 'superset', name: `Superset ${i + 1}`, rounds: 3,
        note: 'Keep it at RPE 8. This day is for balance, not heroics.',
        exercises: [a, b].map((ex, j) =>
          blockExercise(`${String.fromCharCode(66 + i)}${j + 1}`, ex,
            Array.from({ length: 3 }, () => repSet(ex.repHi, j === 1 ? 45 : 0, ex.unilateral, 8)))),
        estimatedSec: 0,
      });
    }
  }

  blocks.push(buildDownregulate(day.archetype, ctx));
  const session: PlannedSession = {
    weekNumber: args.weekNumber, dayNumber: day.dayNumber, weekday: day.weekday, date: args.date,
    archetype: day.archetype, title: TITLES[day.archetype], mainPattern: null,
    isDeload: waveFor(args.weeks)[args.weekNumber - 1]?.isDeload ?? false,
    blocks, estimatedSec: 0, trimLog: [],
  };
  return fitToBudget(session, ctx.sessionCapSec, ctx.paceFactor);
}

export function assembleSession(args: AssembleArgs): PlannedSession {
  const { day, weekNumber, weeks, ctx, state, rng } = args;
  if (!day.mainPattern) return assembleSpecial(args);

  const wave = waveFor(weeks)[weekNumber - 1]!;
  const blocks: SessionBlock[] = [buildPrimer(day.archetype, ctx)];

  // B — the main lift.
  const t1 = pickT1(day, ctx, state, rng);
  const tm = resolveTrainingMax(t1.id, t1.pattern, ctx.trainingMaxes);
  const mainSets = prescriptionFor({ weeks, week: weekNumber, trainingMaxKg: tm, increment: ctx.increment });
  const workingCount = mainSets.filter((s) => s.kind !== 'ramp').length;
  recordUse(state, t1, workingCount);
  blocks.push({
    letter: 'B', kind: 'main', name: 'Main lift',
    note: tm ? 'Leave one or two in the tank. Every rep looks the same.' : 'No training max yet — find a weight that matches the target RPE.',
    exercises: [blockExercise('B', t1, mainSets, t1.defaultTempo)],
    estimatedSec: 0,
  });

  // C — secondary, tempo controlled.
  const t2 = pickT2(day, t1, ctx, state, rng);
  const t2Sets = wave.isDeload ? 2 : 3;
  recordUse(state, t2, t2Sets);
  blocks.push({
    letter: 'C', kind: 'secondary', name: 'Secondary',
    note: 'Tempo is the point. Three seconds down, controlled up.',
    exercises: [blockExercise('C', t2,
      Array.from({ length: t2Sets }, () => repSet(t2.repLo + 2, 90, t2.unilateral, 7.5)), '30X1')],
    estimatedSec: 0,
  });

  // D — accessory superset that closes the week's balance gap.
  const rounds = wave.isDeload ? 2 : 3;
  const [d1, d2, d2Structural] = pickT3Pair(ctx, state, rng);
  recordUse(state, d1, rounds);
  recordUse(state, d2, rounds);
  blocks.push({
    letter: 'D', kind: 'superset', name: 'Accessory superset', rounds,
    note: 'Alternate D1 and D2. Rest only after D2.',
    exercises: [d1, d2].map((ex, i) => ({
      ...blockExercise(`D${i + 1}`, ex, Array.from({ length: rounds }, () => repSet(ex.repHi, i === 1 ? 45 : 0, ex.unilateral, 8.5))),
      structural: i === 0 || d2Structural,
    })),
    estimatedSec: 0,
  });

  // E — finisher (skipped on deload weeks except for easy aerobic).
  const finisher = wave.isDeload ? null : pickFinisher(weekNumber, ctx, state, rng);
  if (finisher) {
    const ex = getExercise(finisher.exercises[0]!.exerciseId);
    recordUse(state, ex, 0);
    blocks.push(finisher);
  }

  blocks.push(buildDownregulate(day.archetype, ctx));

  const session: PlannedSession = {
    weekNumber, dayNumber: day.dayNumber, weekday: day.weekday, date: args.date,
    archetype: day.archetype, title: TITLES[day.archetype], mainPattern: day.mainPattern,
    isDeload: wave.isDeload, blocks, estimatedSec: 0, trimLog: [],
  };
  return fitToBudget(session, ctx.sessionCapSec, ctx.paceFactor);
}

export { TITLES as SESSION_TITLES };
export type { Tier };
