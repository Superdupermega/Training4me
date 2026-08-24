import { afterEach, describe, expect, it } from 'vitest';
import { connectionSummary, db, describeKey } from './db';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role: string, ref = 'evlxbewvsgrlncvtagmf') =>
  `eyJhbGciOiJIUzI1NiJ9.${b64({ role, ref })}.sig`;

const set = (value: string | undefined) => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (value === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = value;
};

afterEach(() => set(undefined));

describe('describeKey', () => {
  it('recognises the correct secret key format', () => {
    expect(describeKey('sb_secret_abc')).toContain('correct type');
  });

  it('calls out the public key being used by mistake', () => {
    expect(describeKey('sb_publishable_abc')).toContain('PUBLIC key');
  });

  it('reads the role and project out of a legacy key', () => {
    expect(describeKey(jwt('service_role'))).toContain('role=service_role');
    expect(describeKey(jwt('service_role'))).toContain('this project');
  });

  it('flags a key belonging to a different project', () => {
    expect(describeKey(jwt('service_role', 'someotherref'))).toContain('WRONG PROJECT');
  });

  it('flags the anon key', () => {
    expect(describeKey(jwt('anon'))).toContain('role=anon');
  });

  it('spots a truncated key', () => {
    expect(describeKey('eyJnope')).toContain('truncated');
  });

  it('never echoes the key itself', () => {
    expect(describeKey('sb_secret_dont_leak_me')).not.toContain('dont_leak_me');
  });
});

describe('db', () => {
  it('names the variable when nothing is configured', () => {
    set(undefined);
    expect(() => db()).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it('accepts either variable name', () => {
    set('sb_secret_abc');
    expect(() => db()).not.toThrow();
    set(undefined);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_abc';
    expect(() => db()).not.toThrow();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('tolerates a stray newline', () => {
    set('sb_secret_abc\n');
    expect(() => db()).not.toThrow();
  });

  it('always points at the right project, whatever the environment says', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://typo.supabase.co';
    expect(connectionSummary()).toContain('evlxbewvsgrlncvtagmf');
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });
});
