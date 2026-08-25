import type { Metadata, Viewport } from 'next';
import { Roboto_Flex } from 'next/font/google';
import { Providers } from '@/theme/Providers';

const sans = Roboto_Flex({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

const TITLE = 'Training4me';
const DESCRIPTION = 'Heavy basics, done well, in under an hour.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: TITLE },
  // The README documents this as the live URL, and src/server/db.ts already
  // hardcodes this deployment's own Supabase project URL the same way — a
  // fork under a different Vercel project name should update both. Without
  // this, Next falls back to resolving the generated OG image against
  // http://localhost:3000, which is wrong in production.
  metadataBase: new URL('https://training4me.vercel.app'),
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', siteName: TITLE },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6FBF6' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1512' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={sans.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
