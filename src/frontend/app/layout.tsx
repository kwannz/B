import { Metadata } from 'next';
import { Providers } from './providers';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Trading Bot Dashboard',
  description: 'Solana Trading Bot Platform',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
