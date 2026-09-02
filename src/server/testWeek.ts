import 'server-only';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { getExercise } from '@/core/library/exercises';
import { buildTestWeek, trainingMaxFromTestResult } from '@/core/progression/testWeek';
import type { Archetype, MovementPattern, PlannedSession, Program } from '@/core/types';
import * as repo from './repo';
import type { TestedOverride } from './nextBlock';

export const TEST_WEEK_SOURCE = 'test_week' as const;

/**
 * A test-week program's `t4m_program.input` carries this instead of a real
 * `GeneratorInput` — exactly the same trick `scheduleRoutine` already plays
 * for a builder-sourced block (`{ routineId, source: 'custom' }`). The
 * column is untyped `jsonb`; `ProgramRow.input` staying typed as
 * `GeneratorInput` is a pre-existing, already-tolerated fiction, not a new
 * one — see docs/DECISIONS.md, chunk 26.
 */
export interface TestWeekMeta {
  source: typeof TEST_WEEK_SOURCE;
  testExerciseIds: string[];
  /** The block this test week followed — where a tested max ultimately gets recorded. */
  parentProgramId: string;
}

function isTestWeekMeta(input: unknown): input is TestWeekMeta {
  return !!input && typeof input === 'object' && (input as { source?: unknown }).source === TEST_WEEK_SOURCE;
}

export function testWeekMeta(program: repo.ProgramRow): TestWeekMeta | null {
  return isTestWeekMeta(program.input) ? (program.input as unknown as TestWeekMeta) : null;
}

/** Every T1 lift the finished block actually trained — one per session with a main block. */
function trainedT1Ids(weekOneSessions: repo.SessionRow[]): string[] {
  const ids = new Set<string>();
  for (const s of weekOneSessions) {
    const id = s.blocks.find((b) => b.kind === 'main')?.exercises[0]?.exerciseId;
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Reconstructs just enough of the core `Program` shape for `buildTestWeek` — week one only, it never needs more. */
function toCoreProgram(program: repo.ProgramRow, weekOneSessions: repo.SessionRow[]): Program {
  const sessions: PlannedSession[] = weekOneSessions.map((s) => ({
    weekNumber: s.weekNumber, dayNumber: s.dayNumber, weekday: s.weekday, date: s.scheduledDate,
    archetype: s.archetype as Archetype, title: s.title,
    mainPattern: s.mainPattern as MovementPattern | null, isDeload: s.isDeload,
    blocks: s.blocks, estimatedSec: s.estimatedSec, trimLog: [],
  }));
  return {
    name: program.name, generatorVersion: 'n/a', weeks: program.weeks, daysPerWeek: program.daysPerWeek,
    startDate: program.startDate, input: program.input,
    plan: [{ weekNumber: 1, isDeload: false, sessions }],
  };
}

/**
 * Builds and persists a short test week off the currently active (just
 * finished) block, making it the new active program — the session player
 * needs no changes at all to run it, exactly like `scheduleRoutine`'s
 * builder-sourced blocks. Reuses `repo.persistProgram` itself (the same
 * insert path `buildProgram` already uses) rather than a third session-
 * insert path — a `PlannedWeek` is a `PlannedWeek` regardless of producer.
 */
export async function startTestWeek(testExerciseIds?: string[]): Promise<{ programId: string; sessionIds: string[] }> {
  const parent = await repo.getActiveProgram();
  if (!parent) throw new Error('No finished block to test');

  const [allSessions, profile, trainingMaxes] = await Promise.all([
    repo.listSessions(parent.id), repo.getProfile(), repo.getTrainingMaxes(),
  ]);
  const weekOne = allSessions.filter((s) => s.weekNumber === 1);
  const ids = testExerciseIds?.length ? testExerciseIds : trainedT1Ids(weekOne);
  if (ids.length === 0) throw new Error('This block trained no main lift to test');

  const increment = profile.microPlates ? 1.25 : 2.5;
  const testWeekStart = format(
    startOfWeek(addDays(parseISO(parent.startDate), parent.weeks * 7), { weekStartsOn: 1 }),
    'yyyy-MM-dd',
  );

  const week = buildTestWeek({
    program: toCoreProgram(parent, weekOne),
    testExerciseIds: ids,
    trainingMaxes,
    startDate: testWeekStart,
    increment,
    paceFactor: profile.paceFactor,
  });
  if (week.sessions.length === 0) throw new Error('None of the requested lifts were trained in this block');

  const meta: TestWeekMeta = { source: TEST_WEEK_SOURCE, testExerciseIds: ids, parentProgramId: parent.id };
  const testProgram: Program = {
    name: `Test week — ${parent.name}`,
    generatorVersion: 'test-week-1.0.0',
    weeks: 1,
    daysPerWeek: week.sessions.length,
    startDate: testWeekStart,
    // Same fiction `scheduleRoutine` already relies on — see `TestWeekMeta`'s own comment.
    input: meta as unknown as Program['input'],
    plan: [week],
  };
  const programId = await repo.persistProgram(testProgram);
  const sessions = await repo.listSessions(programId);
  return { programId, sessionIds: sessions.map((s) => s.id) };
}

/**
 * Reads back what was actually logged against each tested lift's session and
 * turns it into a training-max override — the heaviest weight logged for
 * that exercise in that session (ties broken by reps), which is also
 * whatever the athlete actually hit if they added an on-the-fly set beyond
 * what was prescribed. A lift never attempted (skipped test session, no sets
 * logged) is left out entirely, so `rollOverTrainingMaxes` falls back to its
 * normal inferred path for it — see docs/11-COACH-PLATFORM.md §7.
 */
export async function computeTestedOverrides(
  testProgram: repo.ProgramRow, meta: TestWeekMeta,
): Promise<TestedOverride[]> {
  const [sessions, logs] = await Promise.all([
    repo.listSessions(testProgram.id), repo.getLogsForProgram(testProgram.id),
  ]);

  const overrides: TestedOverride[] = [];
  for (const exerciseId of meta.testExerciseIds) {
    const sessionIds = new Set(
      sessions
        .filter((s) => s.blocks.some((b) => b.kind === 'main' && b.exercises[0]?.exerciseId === exerciseId))
        .map((s) => s.id),
    );
    const attempts = logs.filter((l) =>
      sessionIds.has(l.session_id as string) && l.exercise_id === exerciseId
      && !l.skipped && l.reps != null && l.weight_kg != null);
    if (attempts.length === 0) continue;

    const best = attempts.reduce((a, b) => {
      const aw = Number(a.weight_kg);
      const bw = Number(b.weight_kg);
      if (bw !== aw) return bw > aw ? b : a;
      return (b.reps as number) > (a.reps as number) ? b : a;
    });
    const weightKg = Number(best.weight_kg);
    const reps = best.reps as number;
    const value = trainingMaxFromTestResult(weightKg, reps);
    overrides.push({
      exerciseId, value,
      reason: `${getExercise(exerciseId).name}: tested — ${reps} rep${reps === 1 ? '' : 's'} at ${weightKg} kg.`,
    });
  }
  return overrides;
}
