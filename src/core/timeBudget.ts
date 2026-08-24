import { secondsPerRep } from './tempo';
import type { BlockExercise, PlannedSession, PrescribedSet, SessionBlock } from './types';
import { SessionOverBudgetError } from './types';

export const TRANSITION_SECONDS = 45;
export const FIXED_OVERHEAD_SECONDS = 120;
export const SUPERSET_SWITCH_SECONDS = 15;
export const MIN_SET_WORK_SECONDS = 8;
export const CARRY_SECONDS_PER_METRE = 1.2;
export const HEADROOM = 0.95;

/** Work time for one set, excluding rest. */
export function setWork(set: PrescribedSet, tempo: string): number {
  if (set.durationSec != null) return set.durationSec;
  if (set.distanceM != null) return Math.round(set.distanceM * CARRY_SECONDS_PER_METRE);
  const reps = (set.reps ?? 0) * (set.perSide ? 2 : 1);
  return Math.max(MIN_SET_WORK_SECONDS, Math.round(reps * secondsPerRep(tempo)));
}

export function estimateSet(set: PrescribedSet, tempo: string): number {
  return setWork(set, tempo) + set.restSec;
}

export function estimateExercise(ex: BlockExercise): number {
  return ex.sets.reduce((sum, s) => sum + estimateSet(s, ex.tempo), 0) + TRANSITION_SECONDS;
}

/** Supersets alternate, so rest is paid once per round rather than per exercise. */
export function estimateSuperset(exercises: BlockExercise[], rounds: number): number {
  const perRound = exercises.reduce((sum, ex, i) => {
    const set = ex.sets[0];
    if (!set) return sum;
    const switchCost = i < exercises.length - 1 ? SUPERSET_SWITCH_SECONDS : set.restSec;
    return sum + setWork(set, ex.tempo) + switchCost;
  }, 0);
  return perRound * rounds + TRANSITION_SECONDS;
}

export function estimateBlock(block: SessionBlock): number {
  if (block.rounds && block.rounds > 1) {
    return estimateSuperset(block.exercises, block.rounds);
  }
  return block.exercises.reduce((sum, ex) => sum + estimateExercise(ex), 0);
}

export function estimateSession(blocks: SessionBlock[]): number {
  return blocks.reduce((sum, b) => sum + estimateBlock(b), 0) + FIXED_OVERHEAD_SECONDS;
}

export function applyPaceFactor(seconds: number, paceFactor: number): number {
  return Math.round(seconds * Math.min(1.3, Math.max(0.8, paceFactor)));
}

/** Recompute every cached estimate on a session, bottom-up. */
export function recost(session: PlannedSession, paceFactor = 1): PlannedSession {
  const blocks = session.blocks.map((block) => {
    const exercises = block.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({ ...s, estimatedSec: estimateSet(s, ex.tempo) })),
    }));
    const withSets = { ...block, exercises };
    return { ...withSets, estimatedSec: estimateBlock(withSets) };
  });
  return {
    ...session,
    blocks,
    estimatedSec: applyPaceFactor(estimateSession(blocks), paceFactor),
  };
}

type Trim = { label: string; apply: (s: PlannedSession) => PlannedSession | null };

const dropAccessorySet: Trim = {
  label: 'dropped an accessory round',
  apply: (s) => {
    const block = s.blocks.find((b) => b.kind === 'superset' && (b.rounds ?? 0) > 2);
    if (!block) return null;
    return {
      ...s,
      blocks: s.blocks.map((b) =>
        b === block
          ? { ...b, rounds: (b.rounds ?? 3) - 1, exercises: b.exercises.map((e) => ({ ...e, sets: e.sets.slice(0, -1) })) }
          : b,
      ),
    };
  },
};

const dropAccessoryExercise: Trim = {
  label: 'dropped an accessory exercise',
  apply: (s) => {
    const block = s.blocks.find(
      (b) => b.kind === 'superset' && b.exercises.length > 1 && b.exercises.some((e) => !e.structural),
    );
    if (!block) return null;
    // Drop the last exercise that is not holding up the week's balance.
    let index = -1;
    block.exercises.forEach((e, i) => { if (!e.structural) index = i; });
    if (index < 0) return null;
    return {
      ...s,
      blocks: s.blocks.map((b) =>
        b === block ? { ...b, exercises: b.exercises.filter((_, i) => i !== index) } : b,
      ),
    };
  },
};

const dropFinisher: Trim = {
  label: 'dropped the finisher',
  apply: (s) => {
    if (!s.blocks.some((b) => b.kind === 'finisher')) return null;
    return { ...s, blocks: s.blocks.filter((b) => b.kind !== 'finisher') };
  },
};

const dropSecondarySet: Trim = {
  label: 'dropped a secondary set',
  apply: (s) => {
    const block = s.blocks.find((b) => b.kind === 'secondary' && (b.exercises[0]?.sets.length ?? 0) > 2);
    if (!block) return null;
    return {
      ...s,
      blocks: s.blocks.map((b) =>
        b === block ? { ...b, exercises: b.exercises.map((e) => ({ ...e, sets: e.sets.slice(0, -1) })) } : b,
      ),
    };
  },
};

const shortenPrimer: Trim = {
  label: 'shortened the primer',
  apply: (s) => {
    const block = s.blocks.find((b) => b.kind === 'primer' && (b.rounds ?? 2) > 1);
    if (!block) return null;
    return { ...s, blocks: s.blocks.map((b) => (b === block ? { ...b, rounds: 1 } : b)) };
  },
};

/**
 * Trim ladder, cheapest work first. The main lift is never on this list.
 * The finisher sits below the secondary sets deliberately: carries and trunk
 * work are a stated principle, a third set of dumbbell press is not.
 */
const TRIM_LADDER: Trim[] = [
  dropAccessorySet,
  dropAccessorySet,
  dropAccessoryExercise,
  dropSecondarySet,
  dropSecondarySet,
  dropFinisher,
  shortenPrimer,
];

const addAccessoryRound = (s: PlannedSession): PlannedSession | null => {
  const block = s.blocks.find((b) => b.kind === 'superset' && (b.rounds ?? 0) < 4);
  if (!block) return null;
  return {
    ...s,
    blocks: s.blocks.map((b) => {
      if (b !== block) return b;
      return {
        ...b,
        rounds: (b.rounds ?? 3) + 1,
        exercises: b.exercises.map((e) => {
          const last = e.sets[e.sets.length - 1];
          return last ? { ...e, sets: [...e.sets, { ...last, setNumber: e.sets.length + 1 }] } : e;
        }),
      };
    }),
  };
};

/**
 * Force a session under its cap. Accessories die first; T1 is never touched.
 * If the main lift alone blows the budget we surface it rather than quietly
 * shipping a session that breaks the 60-minute promise.
 */
export function fitToBudget(
  session: PlannedSession,
  capSec: number,
  paceFactor = 1,
): PlannedSession {
  const target = capSec * HEADROOM;
  let current = recost(session, paceFactor);
  const trimLog: string[] = [];

  for (const trim of TRIM_LADDER) {
    if (current.estimatedSec <= target) break;
    const next = trim.apply(current);
    if (!next) continue;
    current = recost(next, paceFactor);
    trimLog.push(trim.label);
  }

  if (current.estimatedSec > capSec) {
    const mainSec = current.blocks
      .filter((b) => b.kind === 'main' || b.kind === 'primer')
      .reduce((sum, b) => sum + b.estimatedSec, 0);
    throw new SessionOverBudgetError({
      archetype: session.archetype,
      estimatedSec: current.estimatedSec,
      capSec,
      mainAndPrimerSec: mainSec,
    });
  }

  // A deload is meant to come in short. Padding it back up defeats the point.
  for (let i = 0; i < 2 && !current.isDeload && current.estimatedSec < target * 0.75; i += 1) {
    const next = addAccessoryRound(current);
    if (!next) break;
    const recosted = recost(next, paceFactor);
    if (recosted.estimatedSec > target) break;
    current = recosted;
    trimLog.push('added an accessory round');
  }

  return { ...current, trimLog };
}
