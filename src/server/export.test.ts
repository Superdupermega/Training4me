import { describe, expect, it } from 'vitest';
import { CSV_HEADER, csvField } from './export';

describe('CSV export column list', () => {
  // docs/02-DATA-MODEL.md's own warning: a field that silently misses an
  // export is drift. `exportLoggedSetsCsv` itself needs a live `db()` this
  // suite has no mocked Supabase to fake (consistent with the rest of
  // `src/server`'s test coverage) — the header is the one part checkable
  // without it, and it is exactly the list a missing column would hide in.
  it('carries session_notes, per docs/chunks/chunk-23-reward-loop.md §5', () => {
    expect(CSV_HEADER).toContain('session_notes');
  });
});

describe('csvField', () => {
  it('leaves a plain value unquoted', () => {
    expect(csvField('back-squat')).toBe('back-squat');
    expect(csvField(5)).toBe('5');
    expect(csvField(true)).toBe('true');
  });

  it('renders null and undefined as an empty field', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  it('quotes and escapes a value containing a comma, quote, or newline', () => {
    expect(csvField('Squat, high bar')).toBe('"Squat, high bar"');
    expect(csvField('5\'8" tall')).toBe('"5\'8"" tall"');
    expect(csvField('line one\nline two')).toBe('"line one\nline two"');
  });
});
