'use client';

import type { Theme } from '@mui/material';
import type { SxProps } from '@mui/system';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Typography, TextField, Button, Card, CardContent, Alert, CircularProgress, Stepper, Step, StepLabel } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from '@/app/components/WalletConnect';

const steps = ['Agent Selection', 'Strategy Creation', 'Bot Integration', 'Wallet Setup', 'Trading Dashboard'];

export default function StrategyCreation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected } = useWallet();
  const agentType = searchParams.get('type') as 'dexSwap' | 'memeCoin' || 'dexSwap';
  const [strategy, setStrategy] = useState('');
  const [slippageTolerance, setSlippageTolerance] = useState(1.0);
  const [sentimentThreshold, setSentimentThreshold] = useState(0.5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!strategy || !connected) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const params = new URLSearchParams({
        type: agentType,
        strategy: strategy,
        ...(agentType === 'dexSwap' ? { slippageTolerance: slippageTolerance.toString() } : {}),
        ...(agentType === 'memeCoin' ? { sentimentThreshold: sentimentThreshold.toString() } : {})
      });
      router.push(`/bot-integration?${params.toString()}`);
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
            Create Your {agentType === 'dexSwap' ? 'DEX Swap' : 'Meme Coin'} Strategy
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

          <Box className="space-y-8">
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                  Strategy Guidelines
                </Typography>
                <Typography variant="body2">
                  • Describe your trading logic and conditions<br />
                  • Specify entry and exit points<br />
                  • Define risk management rules<br />
                  • Set profit targets and stop losses
                </Typography>
              </CardContent>
            </Card>

            <form onSubmit={handleSubmit} className="space-y-6">
              {agentType === 'dexSwap' && (
                <TextField
                  fullWidth
                  type="number"
                  label="Slippage Tolerance (%)"
                  value={slippageTolerance}
                  onChange={(e) => setSlippageTolerance(Number(e.target.value))}
                  inputProps={{ min: 0.1, max: 5.0, step: 0.1 }}
                  disabled={isSubmitting}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'background.paper'
                    }
                  }}
                />
              )}
              
              {agentType === 'memeCoin' && (
                <TextField
                  fullWidth
                  type="number"
                  label="Sentiment Threshold"
                  value={sentimentThreshold}
                  onChange={(e) => setSentimentThreshold(Number(e.target.value))}
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                  disabled={isSubmitting}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'background.paper'
                    }
                  }}
                />
              )}

              <TextField
                fullWidth
                multiline
                rows={6}
                label="Strategy Description"
                value={strategy}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setStrategy(e.target.value)}
                placeholder={`Example: Buy when price drops 5% below 24h average, sell when 3% profit reached or 2% loss...`}
                disabled={isSubmitting}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'background.paper'
                  }
                } as SxProps<Theme>}
              />

              <Box className="flex gap-4">
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  size="large"
                  className="flex-1"
                  startIcon={<ArrowBackIcon />}
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
                  endIcon={!isSubmitting && <ArrowForwardIcon />}
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
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
