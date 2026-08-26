import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRow } from '@/server/repo';
import { SessionPlayer } from './SessionPlayer';

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
