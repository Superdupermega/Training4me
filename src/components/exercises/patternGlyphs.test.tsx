import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PATTERNS } from '@/core/types';
import { PATTERN_GLYPH, PatternGlyph } from './patternGlyphs';

describe('PATTERN_GLYPH', () => {
  // Same reasoning as BodyMap's and BLOCK_KIND_META's own tests: the type
  // system already forces `Record<MovementPattern, string>` to be
  // exhaustive, but a direct test survives that loosening later.
  it.each(PATTERNS)('has a glyph path for %s', (pattern) => {
    expect(typeof PATTERN_GLYPH[pattern]).toBe('string');
    expect(PATTERN_GLYPH[pattern].length).toBeGreaterThan(0);
  });

  it('renders as an aria-hidden decorative svg', () => {
    const { container } = render(<PatternGlyph pattern="squat" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden');
  });
});
