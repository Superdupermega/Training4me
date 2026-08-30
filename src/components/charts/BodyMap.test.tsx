import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS } from '@/core/library/muscles';
import { BACK_PATHS, BodyMap, FRONT_PATHS } from './BodyMap';

describe('BodyMap', () => {
  // The type system already forces `Record<MuscleGroup, string>` to be
  // exhaustive, but this is the runtime guard the brief specifically asked
  // for — worth more than any render assertion if the type ever loosens to
  // `Partial<...>`.
  it.each(MUSCLE_GROUPS)('has a front and a back path for %s', (group) => {
    expect(typeof FRONT_PATHS[group]).toBe('string');
    expect(FRONT_PATHS[group].length).toBeGreaterThan(0);
    expect(typeof BACK_PATHS[group]).toBe('string');
    expect(BACK_PATHS[group].length).toBeGreaterThan(0);
  });

  it('shows an empty state when every group is at zero', () => {
    render(<BodyMap groups={[]} />);
    expect(screen.getByText(/Nothing logged yet/)).toBeInTheDocument();
  });

  it('renders both silhouettes and the hidden fallback table once there is data', () => {
    render(<BodyMap groups={[{ group: 'chest', sets: 6 }, { group: 'back', sets: 4 }]} />);
    expect(screen.getByText('Front')).toBeInTheDocument();
    // "Back" is both a silhouette caption and a muscle-group label (in the
    // hidden fallback table) — assert at least one of each rather than a
    // single unique match.
    expect(screen.getAllByText('Back').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Chest').length).toBeGreaterThanOrEqual(1);
  });
});
