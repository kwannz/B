'use client';

import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Card, CardContent, Grid, Button, Alert, CircularProgress } from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from '../components/WalletConnect';
import { useMetricsStore } from '../stores/metricsStore';

export default function MemeCoinTrading() {
  const router = useRouter();
  const { connected } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const metrics = useMetricsStore(state => state.metrics);

  const handleQuickTrade = async (action: 'buy' | 'sell') => {
    if (!connected) return;

    try {
      setIsSubmitting(true);
      setError(null);
      
      // API call will be implemented here
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addMetric('trading', {
        totalTrades: 1,
        memeCoin: {
          volume: 1, // Will be updated with actual volume
          averageSentiment: 0.75, // Will be updated with actual sentiment
          totalTrades: 1,
          momentum: action === 'buy' ? 1 : -1
        }
      });
      
      router.push('/trading-dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute trade');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className="container mx-auto px-4 py-8">
      <Typography variant="h4" component="h1" className="mb-8">
        Pump.fun Meme Coin Trading
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
              <CardContent>
                {error && (
                  <Alert severity="error" className="mb-4">
                    {error}
                  </Alert>
                )}

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Market Overview
                        </Typography>
                        <Box className="grid grid-cols-2 gap-4">
                          <Box>
                            <Typography color="text.secondary">24h Volume</Typography>
                            <Typography variant="h6">
                              {metrics?.trading?.memeCoin?.volume || '0'} SOL
                            </Typography>
                          </Box>
                          <Box>
                            <Typography color="text.secondary">Sentiment</Typography>
                            <Typography variant="h6" color="success.main">
                              Bullish
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12}>
                    <Box className="flex gap-4">
                      <Button
                        variant="contained"
                        color="success"
                        size="large"
                        fullWidth
                        onClick={() => handleQuickTrade('buy')}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <CircularProgress size={24} />
                        ) : (
                          'Quick Buy'
                        )}
                      </Button>
                      <Button
                        variant="contained"
                        color="error"
                        size="large"
                        fullWidth
                        onClick={() => handleQuickTrade('sell')}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <CircularProgress size={24} />
                        ) : (
                          'Quick Sell'
                        )}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Performance Metrics
                    </Typography>
                    <Box className="space-y-4">
                      <Box>
                        <Typography color="text.secondary">Success Rate</Typography>
                        <Typography variant="h5">
                          {metrics?.trading?.successRate || '0'}%
                        </Typography>
                      </Box>
                      <Box>
                        <Typography color="text.secondary">Active Positions</Typography>
                        <Typography variant="h5">
                          {metrics?.trading?.activePositions || '0'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Risk Level
                    </Typography>
                    <Box className="space-y-2">
                      <Typography variant="h5" color="warning.main">
                        Medium
                      </Typography>
                      <Typography color="text.secondary">
                        Based on market volatility and sentiment analysis
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
