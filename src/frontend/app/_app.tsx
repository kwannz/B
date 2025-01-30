import React from 'react';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, AppBar, Toolbar, Typography } from '@mui/material';
import { ThirdwebProvider, phantomWallet } from "@thirdweb-dev/react";
import { theme } from '../components/mui-theme';

const solanaConfig = {
  name: "Solana",
  chain: "SOL",
  rpc: ["https://api.devnet.solana.com"],
  nativeCurrency: {
    name: "SOL",
    symbol: "SOL",
    decimals: 9,
  },
  shortName: "sol",
  chainId: 103,
  testnet: true,
  slug: "solana-devnet",
  icon: {
    url: "https://solana.com/favicon.ico",
    width: 32,
    height: 32,
    format: "png"
  }
} as const;

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThirdwebProvider
      activeChain={solanaConfig}
      clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}
      supportedWallets={[phantomWallet()]}
      autoConnect={false}
      dAppMeta={{
        name: "Trading Bot",
        description: "Solana Trading Bot Platform",
        logoUrl: "https://solana.com/favicon.ico",
        url: typeof window !== 'undefined' ? window.location.origin : '',
        isDarkMode: true,
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: '100vh',
          bgcolor: '#121212',
          color: '#ffffff'
        }}>
          <AppBar position="fixed" sx={{ bgcolor: '#1e1e1e', boxShadow: 1 }}>
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: '#ffffff' }}>
                Trading Bot Dashboard
              </Typography>
            </Toolbar>
          </AppBar>
          <Box component="main" sx={{ mt: 8, width: '100%', flex: 1 }}>
            <Component {...pageProps} />
          </Box>
        </Box>
      </ThemeProvider>
    </ThirdwebProvider>
  );
}
