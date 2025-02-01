'use client';

import React from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import { DebugProvider } from './contexts/DebugContext';
import { DebugErrorBoundaryWrapper } from './components/DebugErrorBoundary';
import DebugToolbar from './components/DebugToolbar';

export const metadata = {
  title: 'Trading Bot',
  description: 'A sophisticated trading bot with comprehensive debugging capabilities',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LanguageProvider>
          <DebugProvider>
            <DebugErrorBoundaryWrapper>
              {children}
              <DebugToolbar />
            </DebugErrorBoundaryWrapper>
          </DebugProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
