import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRow } from '@/server/repo';
import { SessionSummary } from './SessionSummary';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const logSets = vi.fn();
const saveSessionNotes = vi.fn();
vi.mock('@/server/actions', () => ({
  logSets: (...args: unknown[]) => logSets(...args),
  saveSessionNotes: (...args: unknown[]) => saveSessionNotes(...args),
}));

const generateSessionDebrief = vi.fn();
vi.mock('@/server/coach/actions', () => ({
  generateSessionDebrief: (...args: unknown[]) => generateSessionDebrief(...args),
}));

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 's1', programId: 'p1', weekNumber: 1, dayNumber: 1, weekday: 1,
    scheduledDate: '2026-08-25', archetype: 'upper', title: 'Upper Body',
    mainPattern: 'horizontal_push', isDeload: false, estimatedSec: 3600,
    status: 'completed', startedAt: null, completedAt: '2026-08-25T10:00:00Z',
    actualSec: 3000, readiness: null, autoregulated: false, notes: null,
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

describe('SessionSummary notes (docs/chunks/chunk-23-reward-loop.md §5)', () => {
  beforeEach(() => {
    refresh.mockClear();
    logSets.mockReset();
    saveSessionNotes.mockReset().mockResolvedValue({ ok: true });
  });

  it('saves a new note on blur, not per keystroke', () => {
    render(<SessionSummary session={session()} increment={2.5} initialLogged={{}} prs={[]} />);

    const field = screen.getByLabelText('Notes');
    fireEvent.change(field, { target: { value: 'Felt strong today' } });
    expect(saveSessionNotes).not.toHaveBeenCalled();

    fireEvent.blur(field);
    expect(saveSessionNotes).toHaveBeenCalledWith('s1', 'Felt strong today');
  });

  it('does not fire a save on a blur that changed nothing', () => {
    render(<SessionSummary session={session({ notes: 'Already here' })} increment={2.5} initialLogged={{}} prs={[]} />);

    const field = screen.getByLabelText('Notes');
    fireEvent.focus(field);
    fireEvent.blur(field);
    expect(saveSessionNotes).not.toHaveBeenCalled();
  });

  it('shows an error and leaves the field editable when the save fails', async () => {
    saveSessionNotes.mockResolvedValue({ ok: false, error: 'Network error' });
    render(<SessionSummary session={session()} increment={2.5} initialLogged={{}} prs={[]} />);

    const field = screen.getByLabelText('Notes');
    fireEvent.change(field, { target: { value: 'A note' } });
    fireEvent.blur(field);

    expect(await screen.findByText(/Could not save the note/)).toBeInTheDocument();
  });
});

describe('SessionSummary — coach debrief (docs/chunks/chunk-27-debrief.md §3)', () => {
  beforeEach(() => {
    generateSessionDebrief.mockReset();
  });

  it('renders no debrief card at all, and never calls the action, when the coach is not configured', () => {
    render(<SessionSummary session={session()} increment={2.5} initialLogged={{}} prs={[]} />);
    expect(screen.queryByText("Coach's take")).not.toBeInTheDocument();
    expect(generateSessionDebrief).not.toHaveBeenCalled();
  });

  it('when configured: calls the action once for this session and shows the reply once it resolves', async () => {
    generateSessionDebrief.mockResolvedValue({ ok: true, data: { text: 'Strong squat day.' } });
    render(
      <SessionSummary session={session()} increment={2.5} initialLogged={{}} prs={[]} coachConfigured />,
    );
    expect(screen.getByText("Coach's take")).toBeInTheDocument();
    expect(await screen.findByText('Strong squat day.')).toBeInTheDocument();
    expect(generateSessionDebrief).toHaveBeenCalledTimes(1);
    expect(generateSessionDebrief).toHaveBeenCalledWith('s1');
  });

  it('when configured but the call fails: the card disappears entirely rather than showing a broken state', async () => {
    generateSessionDebrief.mockResolvedValue({ ok: false, error: 'Coach is resting for today — back tomorrow.' });
    render(
      <SessionSummary session={session()} increment={2.5} initialLogged={{}} prs={[]} coachConfigured />,
    );
    // Skeleton first…
    expect(screen.getByText("Coach's take")).toBeInTheDocument();
    // …then nothing, once the failure resolves.
    await waitFor(() => {
      expect(screen.queryByText("Coach's take")).not.toBeInTheDocument();
    });
  });
});
