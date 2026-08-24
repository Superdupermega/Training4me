import { afterEach, describe, expect, it } from 'vitest';
import { db } from './db';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${b64({ role })}.sig`;

const set = (value: string | undefined) => {
  if (value === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = value;
};

afterEach(() => set(undefined));

describe('service key validation', () => {
  it('names the variable when it is missing', () => {
    set(undefined);
    expect(() => db()).toThrow(/is not set/);
  });

  it('says so when the publishable key was pasted instead', () => {
    set('sb_publishable_abc123');
    expect(() => db()).toThrow(/publishable key/);
  });

  it('says which role a legacy key actually carries', () => {
    set(jwt('anon'));
    expect(() => db()).toThrow(/holds the "anon" key, not "service_role"/);
  });

  it('spots a truncated JWT', () => {
    set('eyJ-not-really-a-jwt');
    expect(() => db()).toThrow(/truncated/);
  });

  it('rejects something that is not a Supabase key at all', () => {
    set('hunter2');
    expect(() => db()).toThrow(/not a recognisable Supabase key/);
  });

  it('accepts both valid key formats, and tolerates a stray newline', () => {
    set(jwt('service_role'));
    expect(() => db()).not.toThrow();
    set('sb_secret_abc123');
    expect(() => db()).not.toThrow();
    set(`${jwt('service_role')}\n`);
    expect(() => db()).not.toThrow();
  });
});
