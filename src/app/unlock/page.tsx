import type { Metadata } from 'next';
import { unlock } from '@/server/unlockAction';

export const metadata: Metadata = { title: 'Unlock — Training4me' };

/**
 * A server component, deliberately: no 'use client', no MUI import, no
 * useRouter/useSearchParams. This is the one screen every visit passes
 * through, and it used to ship ~176 kB of First Load JS (client-side
 * TextField/Button/Stack plus router hooks) to render four lines of text
 * and a password field — with `useSearchParams` wrapped in a `Suspense`
 * with no fallback, so the server sent an *empty* body and the whole page
 * was blank until that JS parsed. See docs/07-PRODUCTION-REVIEW.md #21.
 *
 * Colors and type come from the theme's own CSS custom properties
 * (--mui-palette-*, --mui-font-*), set globally by <Providers> in the root
 * layout this page still renders inside — reusing them here needs no MUI
 * component, just the variables MUI's ThemeProvider already put on :root.
 *
 * The form posts straight to the `unlock` server action via its native
 * `action` prop, so submission works with JavaScript off (and, with JS on,
 * Next.js still intercepts it — no behavior change, all bundle saving).
 * `unlock` (src/server/unlockAction.ts) redirects on both outcomes: to
 * `next` on success, back to this page with `?error=` set on failure — the
 * one piece of state a JS-free form round-trips through the URL rather than
 * component state.
 */
export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '0 24px' }}>
      <form
        action={unlock}
        style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <input type="hidden" name="next" value={next && next.startsWith('/') ? next : '/today'} />

        <div>
          <h1 style={{ font: 'var(--mui-font-h1)', margin: '0 0 4px', color: 'var(--mui-palette-text-primary)' }}>
            Training4me
          </h1>
          <p style={{ font: 'var(--mui-font-body1)', margin: 0, color: 'var(--mui-palette-text-secondary)' }}>
            Heavy basics, done well, in under an hour.
          </p>
        </div>

        <div>
          <label
            htmlFor="pin"
            style={{
              display: 'block', font: 'var(--mui-font-caption)', fontWeight: 600, marginBottom: 6,
              color: error ? 'var(--mui-palette-error-main)' : 'var(--mui-palette-text-secondary)',
            }}
          >
            Passphrase
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            autoFocus
            autoComplete="current-password"
            required
            aria-invalid={Boolean(error)}
            aria-describedby="pin-error"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 8,
              border: `1px solid var(--mui-palette-${error ? 'error-main' : 'divider'})`,
              background: 'var(--mui-palette-background-paper)', color: 'var(--mui-palette-text-primary)',
              font: 'var(--mui-font-body1)', outline: 'none',
            }}
          />
          <p
            id="pin-error"
            role={error ? 'alert' : undefined}
            style={{
              font: 'var(--mui-font-caption)', minHeight: '1.2em', margin: '6px 0 0',
              color: 'var(--mui-palette-error-main)',
            }}
          >
            {error ?? ' '}
          </p>
        </div>

        <button
          type="submit"
          style={{
            padding: '10px 24px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: 'var(--mui-palette-primary-main)', color: 'var(--mui-palette-primary-contrastText)',
            font: 'var(--mui-font-button)',
          }}
        >
          Unlock
        </button>
      </form>
    </main>
  );
}
