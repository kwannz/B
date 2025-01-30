'use client';

import Link from 'next/link';
import { Box, Typography, Button, Container, Card, CardContent } from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from '@/app/components/WalletConnect';

export default function Home() {
  const { connected } = useWallet();

  return (
    <Container maxWidth="lg" className="py-8">
      <Box className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
        <Card className="max-w-2xl w-full">
          <CardContent className="space-y-8">
            <Typography variant="h3" component="h1" className="text-center font-bold">
              Trading Bot Platform
            </Typography>
            
            {!connected ? (
              <Box className="space-y-4">
                <Typography variant="subtitle1" color="text.secondary" className="text-center">
                  Connect your wallet to start trading
                </Typography>
                <WalletConnect />
              </Box>
            ) : (
              <Box className="space-y-4">
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
            )}
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
