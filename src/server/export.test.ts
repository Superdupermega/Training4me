import { describe, expect, it } from 'vitest';
import { csvField } from './export';

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
