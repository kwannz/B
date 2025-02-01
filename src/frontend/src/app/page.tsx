'use client';

import React from 'react';
import Link from 'next/link';
import type { LinkProps } from 'next/link';
import { Box, Typography, Button, Container, Card, CardContent, Theme } from '@mui/material';
import { SxProps } from '@mui/system';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from '@/app/components/WalletConnect';

export default function Home() {
  const { connected } = useWallet();

  return (
    <Container maxWidth="lg" className="py-4">
      <Box className="min-h-[calc(100vh-4rem)]">
        {!connected ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="space-y-6">
              <Typography variant="h3" component="h1" className="text-center font-bold">
                Trading Bot Platform
              </Typography>
              <Typography variant="subtitle1" color="text.secondary" className="text-center">
                Connect your wallet to start trading
              </Typography>
              <WalletConnect />
            </CardContent>
          </Card>
        ) : (
          <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="h-full">
              <CardContent>
                <Typography variant="h5" component="h2" className="mb-4">
                  Quick Actions
                </Typography>
                <Box className="space-y-3">
                  <Link href="/agent-selection" className="block">
                    <Button variant="contained" size="large" fullWidth>
                      Start Trading
                    </Button>
                  </Link>
                  <Link href="/wallet-comparison" className="block">
                    <Button variant="outlined" size="large" fullWidth>
                      Compare Wallets
                    </Button>
                  </Link>
                </Box>
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardContent>
                <Typography variant="h5" component="h2" className="mb-4">
                  Trading Overview
                </Typography>
                <Box className="space-y-3">
                  <Link href="/trading-dashboard" className="block">
                    <Button variant="contained" color="secondary" size="large" fullWidth>
                      View Dashboard
                    </Button>
                  </Link>
                  <Link href="/strategy-creation" className="block">
                    <Button variant="outlined" color="secondary" size="large" fullWidth>
                      Create Strategy
                    </Button>
                  </Link>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>
    </Container>
  );
