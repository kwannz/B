'use client';

import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Card, CardContent, Grid, TextField, Slider, Button, Alert } from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMetricsStore } from '../stores/metricsStore';
import WalletConnect from '../components/WalletConnect';

export default function DexSwapPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const [fromToken, setFromToken] = useState('');
  const [toToken, setToToken] = useState('');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1.0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addMetric } = useMetricsStore();
  
  const handleSwap = async () => {
    if (!connected || !fromToken || !toToken || !amount) return;

    try {
      setIsSubmitting(true);
      setError(null);
      
      // API call will be implemented here
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addMetric('trading', {
        totalTrades: 1,
        dexSwap: {
          volume: Number(amount),
          averageSlippage: slippage,
          totalSwaps: 1,
          lastPrice: 0 // Will be updated with actual price
        }
      });
      
      router.push('/trading-dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute swap');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className="container mx-auto px-4 py-8">
      <Typography variant="h4" component="h1" className="mb-8">
        DEX Swap Trading
      </Typography>

      {!connected ? (
        <Card>
          <CardContent className="text-center py-8">
            <Typography variant="h6" className="mb-4">
              Connect your wallet to start trading
            </Typography>
            <WalletConnect />
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent className="space-y-6">
                {error && (
                  <Alert severity="error" className="mb-4">
                    {error}
                  </Alert>
                )}

                <Box className="space-y-4">
                  <Box className="flex gap-4">
                    <TextField
                      fullWidth
                      label="From Token"
                      value={fromToken}
                      onChange={(e) => setFromToken(e.target.value)}
                      placeholder="SOL"
                      disabled={isSubmitting}
                    />
                    <TextField
                      fullWidth
                      label="Amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      type="number"
                      disabled={isSubmitting}
                    />
                  </Box>

                  <TextField
                    fullWidth
                    label="To Token"
                    value={toToken}
                    onChange={(e) => setToToken(e.target.value)}
                    placeholder="USDC"
                    disabled={isSubmitting}
                  />

                  <Box>
                    <Typography gutterBottom>
                      Slippage Tolerance: {slippage}%
                    </Typography>
                    <Slider
                      value={slippage}
                      onChange={(_, value) => setSlippage(value as number)}
                      min={0.1}
                      max={5.0}
                      step={0.1}
                      disabled={isSubmitting}
                      sx={{ width: '100%' }}
                    />
                  </Box>

                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={handleSwap}
                    disabled={!fromToken || !toToken || !amount || isSubmitting}
                  >
                    {isSubmitting ? 'Processing...' : 'Swap Tokens'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Swap Details
                </Typography>
                <Box className="space-y-2">
                  <Box className="flex justify-between">
                    <Typography color="text.secondary">Price Impact</Typography>
                    <Typography>Calculating...</Typography>
                  </Box>
                  <Box className="flex justify-between">
                    <Typography color="text.secondary">Minimum Received</Typography>
                    <Typography>Calculating...</Typography>
                  </Box>
                  <Box className="flex justify-between">
                    <Typography color="text.secondary">Network Fee</Typography>
                    <Typography>Calculating...</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
