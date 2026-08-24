/**
 * The app's lock. Runs in both the Edge middleware and a server action, so it
 * uses Web Crypto only — no Node built-ins.
 *
 * The cookie holds a hash of the PIN, never the PIN itself, so a leaked cookie
 * does not hand over the secret you also typed into Vercel.
 */
const SALT = 'training4me/lock/v1';

export async function deriveToken(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${SALT}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Comparison that does not leak how much of the value matched via timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const COOKIE_NAME = 't4m_unlocked';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;
