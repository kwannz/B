'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Typography, CircularProgress, Button, Card, CardContent, Alert, Stepper, Step, StepLabel } from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from '@/app/components/WalletConnect';
import { createBot } from '@/app/api/client';

const steps = ['Agent Selection', 'Strategy Creation', 'Bot Integration', 'Wallet Setup', 'Trading Dashboard'];

export default function BotIntegration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botId, setBotId] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) {
      setIsProcessing(false);
      return;
    }

    const initializeBot = async () => {
      const type = searchParams.get('type');
      const strategy = searchParams.get('strategy');

      if (!type || !strategy) {
        router.push('/agent-selection');
        return;
      }

      try {
        setIsProcessing(true);
        setError(null);
        const data = await createBot(type, decodeURIComponent(strategy));
        setBotId(data.id);
      } catch (err) {
        console.error('Failed to initialize bot:', err);
        setError('Failed to create trading bot. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    };

    initializeBot();
  }, [router, searchParams, connected]);

  const handleContinue = () => {
    if (!botId || !connected) return;
    router.push(`/key-management?botId=${botId}`);
  };

  const handleBack = () => {
    router.push('/strategy-creation');
  };

  if (!connected) {
    return (
      <Box className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="space-y-6">
            <Typography variant="h5" component="h1" className="text-center mb-4">
              Bot Integration
            </Typography>

            <Stepper activeStep={2} alternativeLabel className="mb-8">
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Alert severity="warning">
              Please connect your wallet to create a trading bot
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
            Bot Integration
          </Typography>

          <Stepper activeStep={2} alternativeLabel className="mb-8">
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

          {isProcessing ? (
            <Box className="flex flex-col items-center gap-4 py-8">
              <CircularProgress />
              <Typography>Initializing your trading bot...</Typography>
            </Box>
          ) : botId ? (
            <Box className="space-y-4">
              <Alert severity="success">
                Trading bot successfully created!
              </Alert>
              <Box className="flex gap-4 mt-6">
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
                  Continue to Wallet Setup
                </Button>
              </Box>
            </Box>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
