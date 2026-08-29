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
  it('opens the row instead of logging the prescribed weight nobody has entered yet', () => {
    // The weight is entered by hand: the plan's 100 kg is what you are
    // *asked* to lift, not evidence of what you lifted. A quick ✓ with the
    // field still empty has to ask rather than invent a log line.
    const onComplete = vi.fn();
    const onExpand = vi.fn();
    render(
      <SetRow
        set={set()} logged={undefined} increment={2.5} expanded={false}
        onExpand={onExpand} onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByLabelText('Complete set 1'));
    expect(onComplete).not.toHaveBeenCalled();
    expect(onExpand).toHaveBeenCalled();
  });

  it('quick-completes without asking once a weight has been carried over', () => {
    // Set 2 of the same movement: the athlete already picked 97.5 on set 1,
    // so there is nothing left to ask — one tap logs it.
    const onComplete = vi.fn();
    render(
      <SetRow
        set={set({ setNumber: 2 })} logged={undefined} carriedWeightKg={97.5} increment={2.5}
        expanded={false} onExpand={() => {}} onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByLabelText('Complete set 2'));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ reps: 5, weightKg: 97.5 }));
  });

  it('offers the prescribed weight as a one-tap suggestion rather than pre-filling it', () => {
    const onComplete = vi.fn();
    render(
      <SetRow
        set={set({ weightKg: 100 })} logged={undefined} increment={2.5} expanded
        onExpand={() => {}} onComplete={onComplete}
      />,
    );
    const weightField = screen.getByLabelText('Weight (kg)') as HTMLInputElement;
    expect(weightField.value).toBe('');
    expect(weightField.placeholder).toBe('100');

    fireEvent.click(screen.getByRole('button', { name: 'Use 100 kg' }));
    expect(weightField.value).toBe('100');
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 100 }));
  });

  it('adopts the suggestion on the first tap of the stepper, then steps from there', () => {
    render(
      <SetRow
        set={set({ weightKg: 100 })} logged={undefined} increment={2.5} expanded
        onExpand={() => {}} onComplete={() => {}}
      />,
    );
    const weightField = screen.getByLabelText('Weight (kg)') as HTMLInputElement;
    fireEvent.click(screen.getByLabelText('Increase Weight (kg)'));
    expect(weightField.value).toBe('100');
    fireEvent.click(screen.getByLabelText('Increase Weight (kg)'));
    expect(weightField.value).toBe('102.5');
  });

  it('logs a set with no weight at all when the field is deliberately left empty', () => {
    // A bodyweight set of a loadable movement — pull-ups, dips. Opening the
    // row and logging it is the explicit "no load" answer; SessionPlayer
    // carries that decision to the rest of the movement.
    const onComplete = vi.fn();
    render(
      <SetRow
        set={set({ weightKg: undefined })} logged={undefined} increment={2.5} expanded
        onExpand={() => {}} onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Log set' }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ weightKg: undefined }));
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

  it('treats a cleared field as "not decided yet", and gibberish as a slip to revert', () => {
    // Clearing the field is meaningful now — it takes the set back to
    // needing a weight, rather than snapping to whatever was there before.
    const onComplete = vi.fn();
    render(
      <SetRow
        set={set({ weightKg: 100 })} logged={undefined} carriedWeightKg={100} increment={2.5} expanded
        onExpand={() => {}} onComplete={onComplete}
      />,
    );
    const weightField = screen.getByLabelText('Weight (kg)') as HTMLInputElement;
    fireEvent.change(weightField, { target: { value: '' } });
    fireEvent.blur(weightField);
    expect(weightField.value).toBe('');

    fireEvent.change(weightField, { target: { value: '105' } });
    fireEvent.change(weightField, { target: { value: 'kg' } });
    fireEvent.blur(weightField);
    expect(weightField.value).toBe('105');
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
        set={set({ weightKg: 102.5 })} logged={undefined} carriedWeightKg={102.5}
        increment={2.5} expanded onExpand={() => {}} onComplete={() => {}} barbell
      />,
    );
    expect(screen.getByText(/per side/)).toBeInTheDocument();

    rerender(
      <SetRow
        set={set({ weightKg: 102.5 })} logged={undefined} carriedWeightKg={102.5}
        increment={2.5} expanded onExpand={() => {}} onComplete={() => {}} barbell={false}
      />,
    );
    expect(screen.queryByText(/per side/)).not.toBeInTheDocument();
  });
});
