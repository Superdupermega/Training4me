import { afterEach, describe, expect, it } from 'vitest';
import { connectionSummary, db } from './db';

const set = (value: string | undefined) => {
  if (value === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = value;
};

afterEach(() => set(undefined));

describe('database connection', () => {
  it('works with zero configuration', () => {
    set(undefined);
    expect(() => db()).not.toThrow();
    expect(connectionSummary()).toContain('key=sb_publishable');
    expect(connectionSummary()).toContain('source=built-in publishable key');
  });

  it('prefers a configured secret key over the built-in publishable one', () => {
    set('sb_secret_example');
    expect(connectionSummary()).toContain('key=sb_secret');
    expect(connectionSummary()).toContain('source=SUPABASE_SECRET_KEY');
  });

  it('tolerates a stray newline on a pasted secret', () => {
    set('sb_secret_example\n');
    expect(connectionSummary()).toContain('key=sb_secret');
  });

  it('always points at the right Supabase project', () => {
    expect(connectionSummary()).toContain('evlxbewvsgrlncvtagmf');
  });

  it('never puts a configured secret key in the summary', () => {
    set('sb_secret_dont_leak_me');
    expect(connectionSummary()).not.toContain('dont_leak_me');
  });
});
