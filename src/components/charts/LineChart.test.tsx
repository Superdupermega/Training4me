import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LineChart, type LinePoint } from './LineChart';

function points(n: number): LinePoint[] {
  return Array.from({ length: n }, (_, i) => ({ label: `W${i + 1}`, value: 100 + i * 2.5 }));
}

describe('LineChart', () => {
  it('shows a signed delta headline from the first point to the last', () => {
    render(<LineChart chartId="a" points={points(4)} unit=" kg" />);
    // 100 -> 107.5, first label W1, last label W4.
    expect(screen.getByText('+7.5 kg from W1 to W4')).toBeInTheDocument();
  });

  it('labels only the first, middle and last point on a long series', () => {
    const { container } = render(<LineChart chartId="b" points={points(12)} />);
    const texts = [...container.querySelectorAll('svg > text')].map((t) => t.textContent);
    // Middle index for 12 points is round((12-1)/2) = 6 -> "W7".
    expect(texts).toContain('W1');
    expect(texts).toContain('W7');
    expect(texts).toContain('W12');
    expect(texts).not.toContain('W2');
    expect(texts).not.toContain('W5');
  });

  it('gives each instance its own gradient id, so two on one page never collide', () => {
    const { container: c1 } = render(<LineChart chartId="e1rm-back-squat" points={points(3)} />);
    const { container: c2 } = render(<LineChart chartId="bodyweight" points={points(3)} />);
    const id1 = c1.querySelector('linearGradient')?.id;
    const id2 = c2.querySelector('linearGradient')?.id;
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    // And the fill actually references its own gradient, not a hardcoded one.
    expect(c1.querySelector('path[fill^="url(#"]')?.getAttribute('fill')).toBe(`url(#${id1})`);
  });

  it('keeps a hidden accessible table alongside the SVG, with every point in it', () => {
    render(<LineChart chartId="c" points={points(4)} unit=" kg" />);
    const table = screen.getByRole('table', { hidden: true });
    expect(within(table).getByText('107.5 kg')).toBeInTheDocument(); // last point's value
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(4);
  });

  it('gives each point an enlarged, keyboard-reachable hit target for tap-to-inspect', () => {
    const { container } = render(<LineChart chartId="d" points={points(3)} />);
    const hits = container.querySelectorAll('circle.lc-hit');
    expect(hits).toHaveLength(3);
    for (const hit of hits) expect(hit).toHaveAttribute('tabindex', '0');
  });

  it('falls back to the empty state under two points', () => {
    render(<LineChart chartId="e" points={points(1)} unit=" kg" />);
    expect(screen.getByText(/one data point/)).toBeInTheDocument();
  });
});
