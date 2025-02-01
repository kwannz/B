'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppBar, Toolbar, Button, Box, Typography, Divider } from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from './WalletConnect';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '../contexts/LanguageContext';

export default function Navigation() {
  const pathname = usePathname();
  const { connected } = useWallet();
  const { t } = useLanguage();

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
                {t('trading.status')}
              </Button>
            </Link>
            <Link href="/wallet-comparison" passHref>
              <Button
                color="primary"
                variant={pathname === '/wallet-comparison' ? 'contained' : 'text'}
              >
                {t('wallet.status')}
              </Button>
            </Link>
          </Box>
        </Box>
        <Box className="flex items-center gap-4">
          <WalletConnect />
          <Divider orientation="vertical" flexItem />
          <LanguageSwitcher />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
