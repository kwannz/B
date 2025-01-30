import './globals.css';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import Navigation from './components/Navigation';
import { Box } from '@mui/material';
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
          <Box className="min-h-screen bg-gray-50">
            <Navigation />
            <Box component="main" className="py-4">
              {children}
            </Box>
          </Box>
        </Providers>
      </body>
    </html>
  );
}
