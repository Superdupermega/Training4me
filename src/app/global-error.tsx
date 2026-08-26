'use client';
import { useEffect } from 'react';

/**
 * The one boundary error.tsx cannot cover: an error thrown by the root
 * layout itself (src/app/layout.tsx) or its <Providers>. Next.js requires
 * this file to render its own <html>/<body> — it replaces the root layout
 * entirely when it activates, so nothing above it, including <Providers>
 * and the MUI theme, can be assumed to have mounted. Deliberately
 * dependency-free: plain inline styles, no MUI import, matching the app's
 * palette (src/theme/theme.ts) by hand so it still looks like this app
 * rather than a blank crash screen (docs/07-PRODUCTION-REVIEW.md #20).
 */
export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // See error.tsx's own copy of this — same best-effort report to
    // Vercel's function logs, duplicated rather than shared because this
    // file must stay import-light (it replaces the root layout, so it's
    // reachable from /unlock too; see api/log-client-error/route.ts for why
    // that rules out a server action here).
    fetch('/api/log-client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        boundary: 'global-error', message: error.message, stack: error.stack,
        digest: error.digest, url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body>
        <style>{`
          :root { color-scheme: light dark; }
          body {
            margin: 0; min-height: 100dvh; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 16px; text-align: center;
            padding: 0 24px; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            background: #F6FBF6; color: #171D19;
          }
          @media (prefers-color-scheme: dark) {
            body { background: #0F1512; color: #DFE4DF; }
          }
          h1 { font-size: 1.375rem; font-weight: 600; margin: 0; }
          p { color: #3F4943; max-width: 320px; margin: 0; }
          @media (prefers-color-scheme: dark) { p { color: #BFC9C2; } }
          .actions { display: flex; gap: 12px; }
          button, a {
            font: inherit; font-weight: 600; font-size: 0.875rem; padding: 10px 20px;
            border-radius: 20px; cursor: pointer; text-decoration: none;
          }
          button { border: 1px solid #1E5F4B; background: transparent; color: #1E5F4B; }
          a { border: none; background: #1E5F4B; color: #FFFFFF; }
          @media (prefers-color-scheme: dark) {
            button { border-color: #7EDBB4; color: #7EDBB4; }
            a { background: #7EDBB4; color: #00382A; }
          }
        `}</style>
        <h1>Training4me hit a snag</h1>
        <p>
          The app failed to load. Nothing you already logged was lost — try
          again, or head back to today&apos;s session.
        </p>
        <div className="actions">
          <button onClick={() => reset()}>Try again</button>
          <a href="/today">Go to Today</a>
        </div>
      </body>
    </html>
  );
}
