import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/today',
    name: 'Training4me',
    short_name: 'Training4me',
    description: 'Heavy basics, done well, in under an hour.',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    // Not locked to portrait: mobile-first, but explicitly built to work on
    // desktop too (docs/06-REDESIGN-PLAN.md) — a desktop PWA install has no
    // "portrait" to lock to, and locking here would fight that requirement.
    orientation: 'any',
    background_color: '#0F1512',
    theme_color: '#1E5F4B',
    categories: ['health', 'fitness', 'lifestyle'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
