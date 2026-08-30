import { describe, expect, it } from 'vitest';
import { BLOCK_KINDS } from '@/core/types';
import { BLOCK_KIND_META } from './blockKindMeta';

describe('BLOCK_KIND_META', () => {
  // The type system already forces this to be exhaustive
  // (`Record<BlockKind, …>`), but a direct test survives the type ever
  // loosening — and is exactly what docs/chunks/chunk-24-craft.md §2 asks for.
  it.each(BLOCK_KINDS)('has an icon and a colour for %s', (kind) => {
    const meta = BLOCK_KIND_META[kind];
    expect(meta).toBeDefined();
    expect(meta.icon).toBeTruthy();
    expect(typeof meta.color).toBe('string');
    expect(meta.color.length).toBeGreaterThan(0);
  });

  it('gives the main lift a distinct colour from a warm-up or cooldown', () => {
    expect(BLOCK_KIND_META.main.color).not.toBe(BLOCK_KIND_META.primer.color);
    expect(BLOCK_KIND_META.main.color).not.toBe(BLOCK_KIND_META.downregulate.color);
  });
});
