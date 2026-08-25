import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Training4me',
    short_name: 'Training4me',
    description: 'Heavy basics, done well, in under an hour.',
    start_url: '/today',
    display: 'standalone',
    background_color: '#0F1512',
    theme_color: '#1E5F4B',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
