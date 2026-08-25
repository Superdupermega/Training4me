'use client';
import { useEffect } from 'react';

/**
 * Registers public/sw.js after the page has finished loading, so the
 * registration itself never competes with real page work for bandwidth or
 * the main thread. Renders nothing — this is a side effect, not UI.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline-shell support is a nice-to-have, not a requirement — a
        // failed registration (unsupported browser, blocked by an extension)
        // should never surface as an error to a fitness app user.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
