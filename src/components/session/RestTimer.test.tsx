import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RestTimer, type NextSetPreview } from './RestTimer';

const nextSet: NextSetPreview = {
  exerciseName: 'Bench Press', setNumber: 3, target: '5 reps', weightKg: 60,
};

describe('RestTimer', () => {
  it('shows the next set — docs/chunks/chunk-24-craft.md §1', () => {
    render(
      <RestTimer
        endsAt={Date.now() + 60_000} totalSec={60} nextSet={nextSet}
        onAdjust={() => {}} onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/Up next: Set 3 · 5 reps @ 60 kg · Bench Press/)).toBeInTheDocument();
  });

  it('shows nothing extra when there is no next set (the last set of the session)', () => {
    render(
      <RestTimer
        endsAt={Date.now() + 60_000} totalSec={60} nextSet={null}
        onAdjust={() => {}} onDismiss={() => {}}
      />,
    );
    expect(screen.queryByText(/Up next/)).not.toBeInTheDocument();
  });

  it('expands to full-screen on tap, and collapses again on a second tap', () => {
    render(
      <RestTimer
        endsAt={Date.now() + 60_000} totalSec={60} nextSet={nextSet}
        onAdjust={() => {}} onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('Expand rest timer'));
    expect(screen.getByLabelText('Collapse')).toBeInTheDocument();
    // Not the default — the set list stays reachable until asked for.
    fireEvent.click(screen.getByLabelText('Collapse'));
    expect(screen.queryByLabelText('Collapse')).not.toBeInTheDocument();
  });

  it('does not throw when Notification and navigator.serviceWorker are unavailable', () => {
    // jsdom itself has neither by default — this asserts the component
    // survives that (rather than only working because a mock backfilled
    // one), which is the real shape of a browser without notification
    // support at all.
    expect(typeof Notification).toBe('undefined');
    expect(() => render(
      <RestTimer
        endsAt={Date.now() + 10} totalSec={10} nextSet={nextSet}
        onAdjust={() => {}} onDismiss={() => {}}
      />,
    )).not.toThrow();
  });

  it('fires onAdjust and onDismiss from the collapsed controls', () => {
    const onAdjust = vi.fn();
    const onDismiss = vi.fn();
    render(
      <RestTimer
        endsAt={Date.now() + 60_000} totalSec={60} nextSet={null}
        onAdjust={onAdjust} onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText('Fifteen seconds more'));
    expect(onAdjust).toHaveBeenCalledWith(15);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
