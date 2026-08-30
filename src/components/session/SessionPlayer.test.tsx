import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRow } from '@/server/repo';
import { SessionPlayer } from './SessionPlayer';
import { enqueue } from './outbox';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const beginSession = vi.fn();
const finishSession = vi.fn();
const logSets = vi.fn();
const applyAutoregulation = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/server/actions', () => ({
  beginSession: (...args: unknown[]) => beginSession(...args),
  finishSession: (...args: unknown[]) => finishSession(...args),
  logSets: (...args: unknown[]) => logSets(...args),
  applyAutoregulation: (...args: unknown[]) => applyAutoregulation(...args),
}));

// The outbox has its own dedicated tests (outbox.test.ts) against a fake
// idb-keyval; this test is about SessionPlayer's own finish-flow logic
// (docs/07-PRODUCTION-REVIEW.md #9), so the outbox itself is a no-op here —
// jsdom has no real IndexedDB for the real module to run against anyway.
vi.mock('./outbox', () => ({
  peek: vi.fn().mockResolvedValue([]),
  drain: vi.fn().mockResolvedValue(0),
  enqueue: vi.fn().mockResolvedValue(0),
}));

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 's1', programId: 'p1', weekNumber: 1, dayNumber: 1, weekday: 1,
    scheduledDate: '2026-08-25', archetype: 'upper', title: 'Upper Body',
    mainPattern: 'horizontal_push', isDeload: false, estimatedSec: 3600,
    status: 'in_progress', startedAt: new Date().toISOString(), completedAt: null,
    actualSec: null, readiness: null, autoregulated: false, notes: null,
    blocks: [{
      letter: 'A', kind: 'main', name: 'Main lift', estimatedSec: 600,
      exercises: [{
        slot: 'A1', exerciseId: 'back-squat', tempo: '20X1', cue: 'Brace and drive.',
        sets: [{ setNumber: 1, kind: 'working', reps: 5, weightKg: 100, restSec: 0, estimatedSec: 30 }],
      }],
    }],
    ...overrides,
  };
}

async function finishTheSession() {
  fireEvent.click(screen.getByRole('button', { name: 'Finish session' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
}

describe('SessionPlayer finish flow', () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    beginSession.mockReset();
    finishSession.mockReset();
    logSets.mockReset();
    applyAutoregulation.mockClear();
  });

  function twoSetMainBlock() {
    return [{
      letter: 'A', kind: 'main', name: 'Main lift', estimatedSec: 600,
      exercises: [{
        slot: 'A1', exerciseId: 'back-squat', tempo: '20X1', cue: 'Brace and drive.',
        sets: [
          { setNumber: 1, kind: 'working', reps: 5, weightKg: 100, restSec: 0, estimatedSec: 30 },
          { setNumber: 2, kind: 'working', reps: 5, weightKg: 100, restSec: 0, estimatedSec: 30 },
        ],
      }],
    }] as SessionRow['blocks'];
  }

  it('persists the RPE backoff to the server, not just client state (#10)', async () => {
    render(
      <SessionPlayer
        session={session({ blocks: twoSetMainBlock() })}
        increment={2.5} initialLogged={{}}
      />,
    );

    fireEvent.click(screen.getByText('Set 1'));
    fireEvent.click(screen.getByLabelText('RPE 9.5'));
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));

    await waitFor(() => expect(applyAutoregulation).toHaveBeenCalledTimes(1));
    const [sessionId, sentBlocks] = applyAutoregulation.mock.calls[0] as [string, SessionRow['blocks']];
    expect(sessionId).toBe('s1');
    // 100kg * 0.95, rounded to the nearest 2.5 — the first-offense factor.
    expect(sentBlocks[0]!.exercises[0]!.sets[1]!.weightKg).toBe(95);
  });

  it('picks up a prior reload-surviving backoff and goes straight to the 10% cut (#10)', async () => {
    // `autoregulated: true` is what applyAutoregulation now sets — this
    // proves a session reloaded after an earlier backoff doesn't restart
    // the escalation from scratch (the toast for a *second* hard set says
    // "twice", not "backing off 5%").
    render(
      <SessionPlayer
        session={session({ blocks: twoSetMainBlock(), autoregulated: true })}
        increment={2.5} initialLogged={{}}
      />,
    );

    fireEvent.click(screen.getByText('Set 1'));
    fireEvent.click(screen.getByLabelText('RPE 9.5'));
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));

    expect(await screen.findByText(/twice at the limit/)).toBeInTheDocument();
  });

  it('carries the weight entered on the first set over to the next one', async () => {
    // Nothing pre-fills a weight any more, so the first set of a movement is
    // typed by hand — and every set after it opens on that number, one tap
    // from logged.
    render(
      <SessionPlayer
        session={session({ blocks: twoSetMainBlock() })}
        increment={2.5} initialLogged={{}}
      />,
    );

    fireEvent.click(screen.getByText('Set 1'));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '97.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));

    // Set 2 was never opened: the one-tap ✓ is enough because the weight is
    // already decided for this movement.
    fireEvent.click(await screen.findByLabelText('Complete set 2'));
    await waitFor(() => expect(screen.getAllByText('5 × 97.5 kg')).toHaveLength(2));
  });

  it('takes the carried-over weight down with the RPE backoff, not just the prescription', async () => {
    // Otherwise the first tap on the next set would quietly put the full
    // load straight back on the bar and undo the backoff.
    render(
      <SessionPlayer
        session={session({ blocks: twoSetMainBlock() })}
        increment={2.5} initialLogged={{}}
      />,
    );

    fireEvent.click(screen.getByText('Set 1'));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '100' } });
    fireEvent.click(screen.getByLabelText('RPE 9.5'));
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));

    fireEvent.click(await screen.findByLabelText('Complete set 2'));
    // 100 × 0.95 — the same first-offence factor the prescription took.
    expect(await screen.findByText('5 × 95 kg')).toBeInTheDocument();
  });

  it('navigates away once finishSession actually succeeds', async () => {
    finishSession.mockResolvedValue({ ok: true });
    render(<SessionPlayer session={session()} increment={2.5} initialLogged={{}} />);

    await finishTheSession();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/today'));
  });

  it('stays put and shows the real error when finishSession fails, instead of navigating away regardless', async () => {
    // Before docs/07-PRODUCTION-REVIEW.md #9's fix, finishSession's result
    // was discarded entirely and the app navigated to /today unconditionally
    // — telling the user the session was complete when it was not.
    finishSession.mockResolvedValue({ ok: false, error: 'Network error' });
    render(<SessionPlayer session={session()} increment={2.5} initialLogged={{}} />);

    await finishTheSession();

    expect(await screen.findByText(/Network error/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('refreshes after skipping readiness only once beginSession actually succeeds', async () => {
    beginSession.mockResolvedValue({ ok: true });
    render(<SessionPlayer session={session({ status: 'planned' })} increment={2.5} initialLogged={{}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(beginSession).toHaveBeenCalledWith('s1', null));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('surfaces a toast rather than silently doing nothing when beginSession fails on skip', async () => {
    // Previously this call was fire-and-forget: on failure the session never
    // got started_at, silently resetting the elapsed timer on reload.
    beginSession.mockResolvedValue({ ok: false, error: 'Session not found' });
    render(<SessionPlayer session={session({ status: 'planned' })} increment={2.5} initialLogged={{}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));

    expect(await screen.findByText(/Session not found/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('SessionPlayer focus mode (docs/chunks/chunk-22-player-feel.md §2)', () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    beginSession.mockReset();
    finishSession.mockReset();
    logSets.mockReset();
    applyAutoregulation.mockClear();
    vi.mocked(enqueue).mockClear();
  });

  // Two movements in one block: A1 (two sets) then A2 (one set) — enough to
  // prove the cursor advances *between* exercises, not just between sets of
  // the same one.
  function twoMovementBlocks() {
    return [{
      letter: 'A', kind: 'main', name: 'Main lift', estimatedSec: 600,
      exercises: [
        {
          slot: 'A1', exerciseId: 'back-squat', tempo: '20X1', cue: 'Brace and drive.',
          sets: [
            { setNumber: 1, kind: 'working', reps: 5, weightKg: 100, restSec: 0, estimatedSec: 30 },
            { setNumber: 2, kind: 'working', reps: 5, weightKg: 100, restSec: 0, estimatedSec: 30 },
          ],
        },
        {
          slot: 'A2', exerciseId: 'bench-press', tempo: '20X1', cue: 'Elbows tucked.',
          sets: [
            { setNumber: 1, kind: 'working', reps: 5, weightKg: 60, restSec: 0, estimatedSec: 30 },
          ],
        },
      ],
    }] as SessionRow['blocks'];
  }

  it('is the default view of an in-progress session and shows only the current movement', () => {
    render(
      <SessionPlayer
        session={session({ blocks: twoMovementBlocks() })}
        increment={2.5} initialLogged={{}}
      />,
    );

    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
    expect(screen.getByText('Movement 1 of 2')).toBeInTheDocument();
  });

  it('does not advance the cursor while a set of the current movement is still unlogged', async () => {
    render(
      <SessionPlayer
        session={session({ blocks: twoMovementBlocks() })}
        increment={2.5} initialLogged={{}}
      />,
    );

    fireEvent.click(screen.getByText('Set 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));

    // Set 2 of Back Squat is still unlogged — the cursor must still be on it.
    await waitFor(() => expect(screen.getByLabelText('Complete set 2')).toBeInTheDocument());
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByText('Movement 1 of 2')).toBeInTheDocument();
  });

  it('advances the cursor to the next movement once every non-ramp set of this one is logged', async () => {
    render(
      <SessionPlayer
        session={session({ blocks: twoMovementBlocks() })}
        increment={2.5} initialLogged={{}}
      />,
    );

    fireEvent.click(screen.getByText('Set 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));
    fireEvent.click(await screen.findByLabelText('Complete set 2'));

    expect(await screen.findByText('Bench Press')).toBeInTheDocument();
    expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
    expect(screen.getByText('Movement 2 of 2')).toBeInTheDocument();
  });

  it('seeds the cursor from what is already logged, resuming mid-session rather than at block A', () => {
    render(
      <SessionPlayer
        session={session({ blocks: twoMovementBlocks() })}
        increment={2.5}
        initialLogged={{
          'A:A1:1': { reps: 5, weightKg: 100, rpe: 8 },
          'A:A1:2': { reps: 5, weightKg: 100, rpe: 8 },
        }}
      />,
    );

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
  });

  it('routes a set logged after navigating back to a previous movement through the same onComplete', async () => {
    render(
      <SessionPlayer
        session={session({ blocks: twoMovementBlocks() })}
        increment={2.5} initialLogged={{}}
      />,
    );

    fireEvent.click(screen.getByText('Set 1'));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));

    // Set 2 carries the 100 kg over automatically; completing it finishes
    // this movement and the cursor advances to Bench Press on its own.
    fireEvent.click(await screen.findByLabelText('Complete set 2'));
    await screen.findByText('Bench Press');

    fireEvent.click(screen.getByLabelText('Previous movement'));
    await screen.findByText('Back Squat');

    // Re-open and correct the already-logged set 1 from here.
    fireEvent.click(screen.getByText('Set 1'));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '105' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));

    // `complete()` — the same one function both views call — always queues
    // through `enqueue` first with a `LoggedSetRow` of this exact shape,
    // whichever view drove the edit. Asserting on it is asserting `complete`
    // itself was reached with the right row, not a view-specific side path.
    await waitFor(() => expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 's1', blockLetter: 'A', slot: 'A1', exerciseId: 'back-squat', setNumber: 1, weightKg: 105,
      }),
    ));
  });

  it('still renders every block in the list view, unchanged', async () => {
    render(
      <SessionPlayer
        session={session({ blocks: twoMovementBlocks() })}
        increment={2.5} initialLogged={{}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'List' }));

    expect(await screen.findByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
  });
});

describe('SessionPlayer ramp presentation (docs/chunks/chunk-24-craft.md §7)', () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    beginSession.mockReset();
    finishSession.mockReset();
    logSets.mockReset();
    applyAutoregulation.mockClear();
    vi.mocked(enqueue).mockClear();
  });

  function rampAndWorkingBlocks() {
    return [{
      letter: 'A', kind: 'main', name: 'Main lift', estimatedSec: 600,
      exercises: [{
        slot: 'A1', exerciseId: 'back-squat', tempo: '20X1', cue: 'Brace and drive.',
        sets: [
          { setNumber: 1, kind: 'ramp', reps: 5, weightKg: 60, restSec: 0, estimatedSec: 20 },
          { setNumber: 2, kind: 'working', reps: 5, weightKg: 100, restSec: 0, estimatedSec: 30 },
          { setNumber: 3, kind: 'working', reps: 5, weightKg: 100, restSec: 0, estimatedSec: 30 },
        ],
      }],
    }] as SessionRow['blocks'];
  }

  // Regression test against docs/07-PRODUCTION-REVIEW.md #14: `totals` and
  // the block-done check both filter `kind !== 'ramp'` independently of the
  // warm-up ladder's grouping, which is presentation only.
  it('excludes ramp sets from the total and from "done", exactly as before the ladder grouping', async () => {
    render(
      <SessionPlayer
        session={session({ blocks: rampAndWorkingBlocks() })}
        increment={2.5} initialLogged={{}}
      />,
    );

    // Two working sets, ramp excluded from the planned total.
    expect(screen.getByText('0/2 sets')).toBeInTheDocument();

    // Logging the ramp set must not move the counter at all. Its row's own
    // overline reads "Ramp", not "Set 1" — SetRow's existing behaviour,
    // unchanged by the ladder grouping around it.
    fireEvent.click(screen.getByText('Ramp'));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));
    await waitFor(() => expect(enqueue).toHaveBeenCalled());
    expect(screen.getByText('0/2 sets')).toBeInTheDocument();

    // Logging a real working set does.
    fireEvent.click(await screen.findByLabelText('Complete set 2'));
    await waitFor(() => expect(screen.getByText('1/2 sets')).toBeInTheDocument());
  });

  it('groups the ramp set under a "Warm-up ladder" heading, still individually loggable', () => {
    render(
      <SessionPlayer
        session={session({ blocks: rampAndWorkingBlocks() })}
        increment={2.5} initialLogged={{}}
      />,
    );

    expect(screen.getByText('Warm-up ladder')).toBeInTheDocument();
    // The ramp set is still its own real, tappable row underneath the heading.
    expect(screen.getByLabelText('Complete set 1')).toBeInTheDocument();
  });
});
