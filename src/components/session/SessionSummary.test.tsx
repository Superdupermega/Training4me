import { fireEvent, render, screen } from '@testing-library/react';
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
