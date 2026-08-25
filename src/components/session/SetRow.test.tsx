import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PrescribedSet } from '@/core/types';
import { SetRow } from './SetRow';

function set(overrides: Partial<PrescribedSet> = {}): PrescribedSet {
  return {
    setNumber: 1, kind: 'working', reps: 5, weightKg: 100, restSec: 180, estimatedSec: 30,
    ...overrides,
  };
}

describe('SetRow', () => {
  it('submits the prescribed reps and weight unchanged when tapped straight to completion', () => {
    const onComplete = vi.fn();
    render(
      <SetRow
        set={set()} logged={undefined} increment={2.5} expanded={false}
        onExpand={() => {}} onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByLabelText('Complete set 1'));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ reps: 5, weightKg: 100 }),
    );
  });

  it('lets a correction be typed directly into the weight field, not just stepped', () => {
    // docs/07-PRODUCTION-REVIEW.md #18 — before this, the only way to change
    // a value was the +/- steppers; 0 -> 102.5 at a 2.5 step was 41 taps.
    const onComplete = vi.fn();
    render(
      <SetRow
        set={set({ weightKg: 100 })} logged={undefined} increment={2.5} expanded
        onExpand={() => {}} onComplete={onComplete}
      />,
    );
    const weightField = screen.getByLabelText('Weight (kg)');
    fireEvent.change(weightField, { target: { value: '102.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 102.5 }));
  });

  it('does not commit an empty or invalid typed value — reverts to the last real one on blur', () => {
    const onComplete = vi.fn();
    render(
      <SetRow
        set={set({ weightKg: 100 })} logged={undefined} increment={2.5} expanded
        onExpand={() => {}} onComplete={onComplete}
      />,
    );
    const weightField = screen.getByLabelText('Weight (kg)') as HTMLInputElement;
    fireEvent.change(weightField, { target: { value: '' } });
    fireEvent.blur(weightField);
    expect(weightField.value).toBe('100');
  });

  it('re-logging an already-completed set calls onComplete again with the edited value', () => {
    // The session summary (#15) relies on exactly this: expanding a done
    // row and resubmitting is how a mistyped set gets corrected.
    const onComplete = vi.fn();
    render(
      <SetRow
        set={set({ weightKg: 100 })} logged={{ reps: 5, weightKg: 100, rpe: 8 }}
        increment={2.5} expanded onExpand={() => {}} onComplete={onComplete}
      />,
    );
    const weightField = screen.getByLabelText('Weight (kg)');
    fireEvent.change(weightField, { target: { value: '105' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 105 }));
  });

  it('shows a done set as a static summary row with no completion button', () => {
    render(
      <SetRow
        set={set()} logged={{ reps: 5, weightKg: 100, rpe: 8 }} increment={2.5}
        expanded={false} onExpand={() => {}} onComplete={() => {}}
      />,
    );
    expect(screen.queryByLabelText('Complete set 1')).not.toBeInTheDocument();
  });

  it('shows plate math for a barbell exercise loaded above the bar, and not for a non-barbell one', () => {
    const { rerender } = render(
      <SetRow
        set={set({ weightKg: 102.5 })} logged={undefined} increment={2.5} expanded
        onExpand={() => {}} onComplete={() => {}} barbell
      />,
    );
    expect(screen.getByText(/per side/)).toBeInTheDocument();

    rerender(
      <SetRow
        set={set({ weightKg: 102.5 })} logged={undefined} increment={2.5} expanded
        onExpand={() => {}} onComplete={() => {}} barbell={false}
      />,
    );
    expect(screen.queryByText(/per side/)).not.toBeInTheDocument();
  });
});
