'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppBar, Toolbar, Button, Box, Typography } from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from './WalletConnect';

export default function Navigation() {
  const pathname = usePathname();
  const { connected } = useWallet();

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar className="max-w-7xl mx-auto w-full justify-between">
        <Box className="flex items-center gap-4">
          <Link href="/" className="no-underline">
            <Typography variant="h6" color="primary" className="font-bold">
              TradingBot
            </Typography>
          </Link>
          <Box className="flex gap-2">
            <Link href="/agent-selection" passHref>
              <Button
                color="primary"
                variant={pathname === '/agent-selection' ? 'contained' : 'text'}
              >
                Start Trading
              </Button>
            </Link>
            <Link href="/wallet-comparison" passHref>
              <Button
                color="primary"
                variant={pathname === '/wallet-comparison' ? 'contained' : 'text'}
              >
                Compare Wallets
              </Button>
            </Link>
          </Box>
        </Box>
        <Box>
          <WalletConnect />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
