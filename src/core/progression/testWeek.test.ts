import { describe, expect, it } from 'vitest';
import type { BlockExercise, GeneratorInput, PlannedSession, Program, SessionBlock } from '../types';
import { epley, trainingMaxFromOneRepMax } from './trainingMax';
import { buildTestWeek, trainingMaxFromTestResult } from './testWeek';

function be(exerciseId: string, kind: BlockExercise['sets'][number]['kind'] = 'working'): BlockExercise {
  return {
    slot: 'X', exerciseId, tempo: '2010', cue: 'cue',
    sets: [{ setNumber: 1, kind, reps: 5, restSec: 90, estimatedSec: 0 }],
  };
}

function block(letter: string, kind: SessionBlock['kind'], exerciseId: string): SessionBlock {
  return { letter, kind, name: kind, exercises: [be(exerciseId)], estimatedSec: 0 };
}

function session(overrides: Partial<PlannedSession> & { blocks: SessionBlock[] }): PlannedSession {
  return {
    weekNumber: 1, dayNumber: 1, weekday: 1, date: '2026-08-24', archetype: 'FB-A',
    title: 'Day', mainPattern: null, isDeload: false, estimatedSec: 0, trimLog: [],
    ...overrides,
  };
}

const input = {} as GeneratorInput;

function program(sessions: PlannedSession[], overrides: Partial<Program> = {}): Program {
  return {
    name: 'Block', generatorVersion: 'gen-1.0.0', weeks: 4, daysPerWeek: sessions.length,
    startDate: '2026-08-03', input,
    plan: [{ weekNumber: 1, isDeload: false, sessions }],
    ...overrides,
  };
}

describe('trainingMaxFromTestResult', () => {
  it('round-trips a tested single to itself, rounded to the increment', () => {
    expect(trainingMaxFromTestResult(140, 1)).toBe(140);
    expect(trainingMaxFromTestResult(141, 1)).toBe(140); // rounds to the nearest 2.5
  });

  it('runs a rep-max test through the same Epley + 90% ratio as a one-rep-max entry', () => {
    const expected = trainingMaxFromOneRepMax(epley(100, 3));
    expect(trainingMaxFromTestResult(100, 3)).toBe(expected);
    expect(trainingMaxFromTestResult(100, 3)).not.toBe(0);
  });

  it('is deliberately less conservative than estimateTrainingMax\'s first-block haircut', () => {
    // estimateTrainingMax(100, 3) applies an extra 5% on top of the 90% ratio;
    // a supervised test result does not — the two must disagree here.
    const tested = trainingMaxFromTestResult(100, 3);
    const firstBlockGuess = Math.round((epley(100, 3) * 0.9 * 0.95) / 2.5) * 2.5;
    expect(tested).not.toBe(firstBlockGuess);
  });
});

describe('buildTestWeek', () => {
  const squatDay = session({
    dayNumber: 1, weekday: 1, mainPattern: 'squat',
    blocks: [
      block('A', 'primer', 'goblet-squat'),
      block('B', 'main', 'back-squat'),
      block('C', 'secondary', 'walking-lunge'),
      block('D', 'superset', 'plank'),
    ],
  });
  const benchDay = session({
    dayNumber: 2, weekday: 3, mainPattern: 'push_h',
    blocks: [
      block('A', 'primer', 'band-pull-apart'),
      block('B', 'main', 'bench-press'),
      block('C', 'secondary', 'single-arm-db-row'),
    ],
  });
  const aerobicDay = session({
    dayNumber: 3, weekday: 5, mainPattern: null,
    blocks: [block('A', 'primer', 'brisk-walk')],
  });

  const baseArgs = {
    testExerciseIds: ['back-squat', 'bench-press'],
    trainingMaxes: { 'back-squat': 140, 'bench-press': 100 },
    startDate: '2026-09-07', // a Monday
    increment: 2.5,
    paceFactor: 1,
  };

  it('produces one session per tested T1 lift, skipping untested and non-main days', () => {
    const week = buildTestWeek({ program: program([squatDay, benchDay, aerobicDay]), ...baseArgs });
    expect(week.sessions).toHaveLength(2);
    expect(week.sessions.map((s) => s.mainPattern)).toEqual(['squat', 'push_h']);
  });

  it('tests only the requested lifts, not every T1 the block trained', () => {
    const week = buildTestWeek({
      program: program([squatDay, benchDay]), ...baseArgs, testExerciseIds: ['back-squat'],
    });
    expect(week.sessions).toHaveLength(1);
    expect(week.sessions[0]?.blocks.find((b) => b.kind === 'main')?.exercises[0]?.exerciseId).toBe('back-squat');
  });

  it('carries the primer over verbatim and runs no T1 trimming ladder', () => {
    const week = buildTestWeek({ program: program([squatDay]), ...baseArgs, testExerciseIds: ['back-squat'] });
    const s = week.sessions[0]!;
    expect(s.blocks.find((b) => b.kind === 'primer')?.exercises[0]?.exerciseId).toBe('goblet-squat');
    expect(s.trimLog).toEqual([]);
  });

  it('ramps toward the current training max and ends on a single top set', () => {
    const week = buildTestWeek({ program: program([squatDay]), ...baseArgs, testExerciseIds: ['back-squat'] });
    const main = week.sessions[0]!.blocks.find((b) => b.kind === 'main')!;
    const sets = main.exercises[0]!.sets;
    expect(sets.filter((s) => s.kind === 'ramp')).toHaveLength(3);
    expect(sets.at(-1)?.kind).toBe('top');
    expect(sets.at(-1)?.reps).toBe(1);
    expect(sets.at(-1)?.weightKg).toBe(140);
  });

  it('falls back to RPE with no fabricated weight when there is no training max on file', () => {
    const week = buildTestWeek({
      program: program([squatDay]), testExerciseIds: ['back-squat'], trainingMaxes: {},
      startDate: baseArgs.startDate, increment: 2.5, paceFactor: 1,
    });
    const main = week.sessions[0]!.blocks.find((b) => b.kind === 'main')!;
    const sets = main.exercises[0]!.sets;
    expect(sets).toHaveLength(1); // no ramp without a target to ramp toward
    expect(sets[0]?.weightKg).toBeUndefined();
    expect(sets[0]?.rpe).toBe(9);
  });

  it('adds a light accessory pass, not a full block worth of volume', () => {
    const week = buildTestWeek({ program: program([squatDay]), ...baseArgs, testExerciseIds: ['back-squat'] });
    const accessory = week.sessions[0]!.blocks.find((b) => b.letter === 'C')!;
    expect(accessory.exercises[0]?.exerciseId).toBe('walking-lunge');
    expect(accessory.exercises[0]?.sets).toHaveLength(2);
  });

  it('schedules each session on the weekday the block already trained that pattern', () => {
    const week = buildTestWeek({ program: program([squatDay, benchDay]), ...baseArgs });
    expect(week.sessions[0]?.date).toBe('2026-09-07'); // weekday 1, the Monday itself
    expect(week.sessions[1]?.date).toBe('2026-09-09'); // weekday 3, two days later
  });

  it('returns an empty week rather than throwing when the program has no template week', () => {
    const week = buildTestWeek({ program: program([], { plan: [] }), ...baseArgs });
    expect(week.sessions).toEqual([]);
  });
});
