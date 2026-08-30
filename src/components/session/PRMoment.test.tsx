import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Pr } from '@/server/repo';
import { PRMoment } from './PRMoment';

function pr(overrides: Partial<Pr> = {}): Pr {
  return {
    id: 'pr1', exercise_id: 'back-squat', kind: 'e1rm', value: 145,
    reps: 5, weight_kg: 125, achieved_at: '2026-08-30', session_id: 's1',
    ...overrides,
  };
}

describe('PRMoment', () => {
  it('renders nothing when there are no PRs', () => {
    const { container } = render(<PRMoment prs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a card per PR, naming the lift and its kind', () => {
    render(<PRMoment prs={[pr(), pr({ id: 'pr2', exercise_id: 'bench-press', kind: 'best_set', value: 100 })]} />);
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText(/1RM · New record/)).toBeInTheDocument();
    expect(screen.getByText(/Best set · New record/)).toBeInTheDocument();
  });

  it('re-renders off the current prs prop — a revoked PR disappears, not a snapshot from mount', () => {
    const { rerender } = render(<PRMoment prs={[pr()]} />);
    expect(screen.getByText('Back Squat')).toBeInTheDocument();

    // An edit in SessionSummary re-ran PR detection and this one no longer holds.
    rerender(<PRMoment prs={[]} />);
    expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
  });
});
