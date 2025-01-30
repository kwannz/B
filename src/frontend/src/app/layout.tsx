import './globals.css';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import Navigation from './components/Navigation';
import { Box } from '@mui/material';
import { DebugErrorBoundary } from './components/DebugErrorBoundary';
import { DebugMetricsProvider } from './providers/DebugMetricsProvider';
import { DebugMetricsDashboard } from './components/DebugMetricsDashboard';
import { DebugToolbar } from './components/DebugToolbar';
import '@solana/wallet-adapter-react-ui/styles.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Trading Bot Dashboard',
  description: 'Advanced trading bot management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <DebugErrorBoundary>
            <DebugMetricsProvider>
              <Box className="min-h-screen bg-gray-50">
                <Navigation />
                <DebugToolbar />
                <Box component="main" className="py-4">
                  {children}
                </Box>
                {process.env.NODE_ENV !== 'production' && (
                  <Box className="fixed bottom-0 left-0 right-0 bg-white shadow-lg">
                    <DebugMetricsDashboard />
                  </Box>
                )}
              </Box>
            </DebugMetricsProvider>
          </DebugErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
