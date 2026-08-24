import type { Metadata, Viewport } from 'next';
import { Roboto_Flex } from 'next/font/google';
import { Providers } from '@/theme/Providers';

const sans = Roboto_Flex({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Training4me',
  description: 'Heavy basics, done well, in under an hour.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Training4me' },
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
