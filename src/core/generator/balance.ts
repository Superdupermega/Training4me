import { getExercise } from '../library/exercises';
import { find, type LibraryContext } from '../library/query';
import type { MovementPattern, PlannedSession, PlannedWeek } from '../types';
import type { GenContext } from './context';

export interface BalanceViolation {
  code: string;
  message: string;
  value?: number;
  allowed?: string;
}

const LOWER_UNI: MovementPattern[] = ['squat', 'hinge', 'lunge', 'isolation_lower'];
const COUNTED_BLOCKS = new Set(['main', 'secondary', 'superset']);

export interface WeekCounts {
  sets: Record<string, number>;
  /** T1/T2 only — squat vs hinge balance is about the heavy work, not curls. */
  structural: Record<string, number>;
  total: number;
  unilateralLower: boolean;
  unilateralUpper: boolean;
  carries: number;
  pullV: boolean;
  pushV: boolean;
  t1PerSession: number[];
  useCount: Record<string, number>;
  mainPatternDays: { pattern: MovementPattern; weekday: number }[];
}

/** Recomputed from the actual plan, never from the builder's bookkeeping. */
export function countWeek(week: PlannedWeek): WeekCounts {
  const counts: WeekCounts = {
    sets: {}, structural: {}, total: 0, unilateralLower: false, unilateralUpper: false,
    carries: 0, pullV: false, pushV: false, t1PerSession: [], useCount: {},
    mainPatternDays: [],
  };

  for (const session of week.sessions) {
    let t1 = 0;
    if (session.mainPattern) {
      counts.mainPatternDays.push({ pattern: session.mainPattern, weekday: session.weekday });
    }
    for (const block of session.blocks) {
      for (const be of block.exercises) {
        const ex = getExercise(be.exerciseId);
        if (block.kind === 'primer' || block.kind === 'downregulate') continue;
        // Primer and cool-down movements repeat by design; only real work counts.
        counts.useCount[ex.id] = (counts.useCount[ex.id] ?? 0) + 1;
        if (ex.pattern === 'carry') counts.carries += 1;
        if (ex.unilateral && COUNTED_BLOCKS.has(block.kind)) {
          if (LOWER_UNI.includes(ex.pattern)) counts.unilateralLower = true;
          else if (!['trunk', 'mobility', 'aerobic', 'carry'].includes(ex.pattern)) counts.unilateralUpper = true;
        }
        if (!COUNTED_BLOCKS.has(block.kind)) continue;
        const working = be.sets.filter((s) => s.kind !== 'ramp').length;
        counts.sets[ex.pattern] = (counts.sets[ex.pattern] ?? 0) + working;
        if (ex.tier === 'T1' || ex.tier === 'T2') {
          counts.structural[ex.pattern] = (counts.structural[ex.pattern] ?? 0) + working;
        }
        counts.total += working;
        if (ex.pattern === 'pull_v') counts.pullV = true;
        if (ex.pattern === 'push_v') counts.pushV = true;
        // With limited equipment the "main lift" may be the best T2 available;
        // what matters is that the day has exactly one heavy centrepiece.
        if (block.kind === 'main') t1 += 1;
      }
    }
    if (session.mainPattern) counts.t1PerSession.push(t1);
  }
  return counts;
}

export const VOLUME_BANDS: Record<number, [number, number]> = {
  2: [20, 34], 3: [30, 46], 4: [38, 58], 5: [40, 62], 6: [44, 76],
};

const sum = (c: WeekCounts, ...p: MovementPattern[]) => p.reduce((s, k) => s + (c.sets[k] ?? 0), 0);

/**
 * `full` checks structural balance (ratios, volume, unilateral coverage) and is
 * run on the template week, which is what actually decides the movements.
 * `invariants` checks what must hold in every single week regardless of where
 * the wave has taken the set counts.
 */
export type ValidationMode = 'full' | 'invariants';

export function validateWeek(
  week: PlannedWeek,
  daysPerWeek: number,
  lib: LibraryContext,
  mode: ValidationMode = 'full',
): BalanceViolation[] {
  // A deload deliberately drops carries and runs low volume.
  const deload = week.isDeload;
  const c = countWeek(week);
  const v: BalanceViolation[] = [];
  const has = (pattern: MovementPattern) => find(lib, { pattern }).length > 0;

  const pull = sum(c, 'pull_h', 'pull_v');
  const push = sum(c, 'push_h', 'push_v');
  if (mode === 'full' && push > 0) {
    const ratio = pull / push;
    if (ratio < 1 || ratio > 1.45) {
      v.push({ code: 'B1', message: `Pull:push ratio ${ratio.toFixed(2)}`, value: ratio, allowed: '1.00–1.45' });
    }
  }

  if (mode === 'full' && daysPerWeek >= 3) {
    const squat = c.structural.squat ?? 0;
    const hinge = c.structural.hinge ?? 0;
    if (squat > 0) {
      const ratio = hinge / squat;
      if (ratio < 0.75 || ratio > 1.3) {
        v.push({ code: 'B2', message: `Hinge:squat ratio ${ratio.toFixed(2)}`, value: ratio, allowed: '0.75–1.30' });
      }
    }
  }

  if (mode === 'full' && !c.unilateralLower) v.push({ code: 'B3', message: 'No unilateral lower-body work this week' });
  if (mode === 'full' && daysPerWeek >= 3 && !c.unilateralUpper && find(lib, { unilateral: true, pattern: ['push_h', 'push_v', 'pull_h', 'pull_v'] }).length > 0) {
    v.push({ code: 'B4', message: 'No unilateral upper-body work this week' });
  }
  if (!deload && c.carries === 0 && has('carry')) v.push({ code: 'B5', message: 'No loaded carry this week' });
  if (!c.pullV && has('pull_v')) v.push({ code: 'B6a', message: 'No vertical pull this week' });
  if (!c.pushV && has('push_v')) v.push({ code: 'B6b', message: 'No vertical press this week' });

  for (let i = 0; i < c.mainPatternDays.length; i += 1) {
    for (let j = i + 1; j < c.mainPatternDays.length; j += 1) {
      const a = c.mainPatternDays[i]!;
      const b = c.mainPatternDays[j]!;
      if (a.pattern !== b.pattern) continue;
      const gap = Math.min(Math.abs(b.weekday - a.weekday), 7 - Math.abs(b.weekday - a.weekday));
      if (gap < 2) v.push({ code: 'B7', message: `${a.pattern} trained heavy twice inside 48 hours` });
    }
  }

  if (c.t1PerSession.some((n) => n !== 1)) {
    v.push({ code: 'B9', message: 'A loaded session does not have exactly one main lift' });
  }

  const band = VOLUME_BANDS[daysPerWeek];
  if (mode === 'full' && !deload && band && (c.total < band[0] || c.total > band[1])) {
    v.push({ code: 'B8', message: `Weekly working sets ${c.total}`, value: c.total, allowed: `${band[0]}–${band[1]}` });
  }

  const overused = mode === 'full' ? Object.entries(c.useCount).filter(([, n]) => n > 3) : [];
  if (overused.length) {
    v.push({ code: 'B10', message: `Overused: ${overused.map(([id]) => id).join(', ')}` });
  }

  return v;
}

/** Swap one accessory to close a deficit. Returns null when nothing helps. */
export function repairWeek(
  week: PlannedWeek,
  violations: BalanceViolation[],
  ctx: GenContext,
  lib: LibraryContext,
  rng: () => number,
): PlannedWeek | null {
  const codes = new Set(violations.map((x) => x.code));
  const hasSlot = (s: PlannedWeek['sessions'][number], slot: string) =>
    s.blocks.some((b) => b.kind === 'superset' && b.exercises.some((e) => e.slot === slot));

  const swapAccessory = (slot: string, opts: Parameters<typeof find>[1]): PlannedWeek | null => {
    // Prefer the latest session carrying this slot, so earlier days stay stable.
    const candidatesSessions = week.sessions.filter((s) => hasSlot(s, slot));
    const target = candidatesSessions[candidatesSessions.length - 1];
    if (!target) return null;
    const candidates = find(lib, opts).filter(
      (c) => !target.blocks.some((b) => b.exercises.some((e) => e.exerciseId === c.id)),
    );
    const choice = candidates[Math.floor(rng() * candidates.length)] ?? candidates[0];
    if (!choice) return null;
    return {
      ...week,
      sessions: week.sessions.map((s) =>
        s !== target ? s : {
          ...s,
          blocks: s.blocks.map((b) =>
            b.kind !== 'superset' ? b : {
              ...b,
              exercises: b.exercises.map((e) =>
                e.slot !== slot ? e : {
                  ...e, exerciseId: choice.id, cue: choice.cue, tempo: choice.defaultTempo,
                  substitutedFrom: e.exerciseId,
                  sets: e.sets.map((st) => ({ ...st, perSide: choice.unilateral, reps: choice.repHi })),
                }),
            }),
        }),
    };
  };

  if (codes.has('B3')) {
    const fixed = swapAccessory('D2', { pattern: ['lunge', 'isolation_lower'], tier: ['T2', 'T3'], unilateral: true });
    if (fixed) return fixed;
  }
  if (codes.has('B4')) {
    const fixed = swapAccessory('D2', { pattern: ['pull_h', 'push_v', 'isolation_upper'], tier: ['T2', 'T3'], unilateral: true });
    if (fixed) return fixed;
  }
  if (codes.has('B6a')) {
    const fixed = swapAccessory('D1', { pattern: 'pull_v', tier: ['T2', 'T3'] });
    if (fixed) return fixed;
  }
  if (codes.has('B6b')) {
    const fixed = swapAccessory('D1', { pattern: 'push_v', tier: ['T2', 'T3'] });
    if (fixed) return fixed;
  }
  const b1 = violations.find((x) => x.code === 'B1');
  if (b1 && b1.value != null) {
    const needPull = b1.value < 1;
    const fixed = swapAccessory('D1', {
      pattern: needPull ? ['pull_h', 'pull_v'] : ['push_h', 'push_v'],
      tier: ['T2', 'T3'],
    });
    if (fixed) return fixed;
  }
  return null;
}
