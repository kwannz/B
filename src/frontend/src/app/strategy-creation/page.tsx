'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Typography, TextField, Button, Card, CardContent, Alert, CircularProgress, Stepper, Step, StepLabel } from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from '@/app/components/WalletConnect';

const steps = ['Agent Selection', 'Strategy Creation', 'Bot Integration', 'Wallet Setup', 'Trading Dashboard'];

export default function StrategyCreation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected } = useWallet();
  const agentType = searchParams.get('type') || 'trading';
  const [strategy, setStrategy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strategy || !connected) return;

    try {
      setIsSubmitting(true);
      setError(null);
      router.push(`/bot-integration?type=${agentType}&strategy=${encodeURIComponent(strategy)}`);
    } catch (err) {
      console.error('Failed to submit strategy:', err);
      setError('Failed to submit strategy. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push('/agent-selection');
  };

  if (!connected) {
    return (
      <Box className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="space-y-6">
            <Typography variant="h5" component="h1" className="text-center mb-4">
              Create Your {agentType === 'trading' ? 'Trading' : 'DeFi'} Strategy
            </Typography>

            <Stepper activeStep={1} alternativeLabel className="mb-8">
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Alert severity="warning">
              Please connect your wallet to create a trading strategy
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
            Create Your {agentType === 'trading' ? 'Trading' : 'DeFi'} Strategy
          </Typography>

          <Stepper activeStep={1} alternativeLabel className="mb-8">
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Strategy Description"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder={`Describe your ${agentType} strategy...`}
              disabled={isSubmitting}
            />

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
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={!strategy || isSubmitting}
                className="flex-1 relative"
              >
                {isSubmitting ? (
                  <>
                    <CircularProgress size={24} className="absolute" />
                    <span className="opacity-0">Continue</span>
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
