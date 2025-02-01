'use client';

import type { Theme } from '@mui/material';
import type { SxProps } from '@mui/system';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Typography, Button, Card, CardContent, Alert, CircularProgress, Stepper, Step, StepLabel } from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from '@/app/components/WalletConnect';
import { createWallet } from '@/app/api/client';

const steps = ['Agent Selection', 'Strategy Creation', 'Bot Integration', 'Wallet Setup', 'Trading Dashboard'];

interface Wallet {
  address: string;
  private_key: string;
  bot_id: string;
  balance: number;
}

export default function KeyManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected } = useWallet();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!connected) {
      setIsLoading(false);
      return;
    }

    const initializeWallet = async () => {
      const botId = searchParams.get('botId');
      if (!botId) {
        router.push('/agent-selection');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await createWallet(botId);
        setWallet(data);
      } catch (err) {
        console.error('Failed to create wallet:', err);
        setError('Failed to create wallet. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeWallet();
  }, [router, searchParams, connected]);

  const handleContinue = () => {
    const botId = searchParams.get('botId');
    if (!botId || !wallet || !connected) return;
    router.push(`/trading-dashboard?botId=${botId}`);
  };

  const handleBack = () => {
    router.push('/bot-integration');
  };

  if (!connected) {
    return (
      <Box className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="space-y-6">
            <Typography variant="h5" component="h1" className="text-center mb-4">
              Wallet Setup
            </Typography>

            <Stepper activeStep={3} alternativeLabel className="mb-8">
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Alert severity="warning">
              Please connect your wallet to continue with wallet setup
            </Alert>
            <WalletConnect />
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box className="container mx-auto px-4 py-8">
      <Card className="max-w-4xl mx-auto">
        <CardContent className="space-y-6">
          <Typography variant="h5" component="h1" className="text-center mb-4">
            Wallet Setup
          </Typography>

          <Stepper activeStep={3} alternativeLabel className="mb-8">
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Box className="flex flex-col items-center gap-4 py-8">
              <CircularProgress />
              <Typography>Creating your wallet...</Typography>
            </Box>
          ) : wallet ? (
            <Box className="space-y-6">
              <Alert severity="warning">
                Important: Save your wallet information securely. The private key will only be shown once.
              </Alert>

              <Box className="space-y-2">
                <Typography variant="subtitle2" color="text.secondary">
                  Wallet Address
                </Typography>
                <Typography className="break-all font-mono p-4 bg-gray-100 rounded">
                  {wallet.address}
                </Typography>
              </Box>

              <Box className="space-y-2">
                <Typography variant="subtitle2" color="text.secondary">
                  Initial Balance
                </Typography>
                <Typography variant="h6">
                  {wallet.balance.toFixed(4)} SOL
                </Typography>
              </Box>

              <Box className="space-y-4">
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                >
                  {showPrivateKey ? 'Hide' : 'Show'} Private Key
                </Button>
                {showPrivateKey && (
                  <Box className="p-4 bg-gray-100 rounded">
                    <Typography className="break-all font-mono">
                      {wallet.private_key}
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box className="flex gap-4">
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  size="large"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleContinue}
                  size="large"
                  className="flex-1"
                >
                  Continue to Dashboard
                </Button>
              </Box>
            </Box>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
