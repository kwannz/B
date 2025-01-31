'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Typography, Grid, Card, CardContent, Button, Alert, CircularProgress, Stepper, Step, StepLabel, Theme } from '@mui/material';
import { SxProps } from '@mui/system';
import { useWallet } from '@solana/wallet-adapter-react';
import { getBotStatus, updateBotStatus, getWallet } from '@/app/api/client';
import WalletConnect from '@/app/components/WalletConnect';

const steps = ['Agent Selection', 'Strategy Creation', 'Bot Integration', 'Wallet Setup', 'Trading Dashboard'];

interface Trade {
  id: string;
  timestamp: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'completed' | 'pending' | 'failed';
}

export default function TradingDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected } = useWallet();
  const [botStatus, setBotStatus] = useState<'active' | 'inactive'>('inactive');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const botId = searchParams.get('botId');
    if (!botId || !connected) {
      router.push('/agent-selection');
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [statusData, walletData] = await Promise.all([
          getBotStatus(botId),
          getWallet(botId)
        ]);

        setBotStatus(statusData.status);
        setWalletBalance(walletData.balance);
        setTrades(statusData.trades || []);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [router, searchParams, connected]);

  const handleToggleBot = async () => {
    const botId = searchParams.get('botId');
    if (!botId || !connected) return;

    try {
      setIsUpdating(true);
      setError(null);
      const newStatus = botStatus === 'active' ? 'inactive' : 'active';
      const data = await updateBotStatus(botId, newStatus);
      setBotStatus(data.status);
    } catch (err) {
      console.error('Failed to update bot status:', err);
      setError('Failed to update bot status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBack = () => {
    router.push('/key-management');
  };

  if (!connected) {
    return (
      <Box className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="space-y-6">
            <Typography variant="h5" component="h1" className="text-center mb-4">
              Trading Dashboard
            </Typography>

            <Stepper activeStep={4} alternativeLabel className="mb-8">
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Alert severity="warning">
              Please connect your wallet to view the trading dashboard
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
            Trading Dashboard
          </Typography>

          <Stepper activeStep={4} alternativeLabel className="mb-8">
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
            <Box className="flex justify-center py-8">
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <Card className="h-full">
                  <CardContent className="space-y-4">
                    <Box className="flex justify-between items-center">
                      <Typography variant="h6">Bot Status</Typography>
                      <Typography 
                        variant="body2"
                        color={botStatus === 'active' ? 'success.main' : 'error.main'}
                        className="font-bold px-2 py-1 rounded-full bg-opacity-10"
                        sx={{ bgcolor: (theme) => `${botStatus === 'active' ? theme.palette.success.main : theme.palette.error.main}20` }}
                      >
                        {botStatus.toUpperCase()}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      color={botStatus === 'active' ? 'error' : 'success'}
                      onClick={handleToggleBot}
                      disabled={isUpdating}
                      className="relative"
                      fullWidth
                      sx={{ mt: 2 }}
                    >
                      {isUpdating ? (
                        <>
                          <CircularProgress size={24} className="absolute" />
                          <span className="opacity-0">
                            {botStatus === 'active' ? 'Stop Bot' : 'Start Bot'}
                          </span>
                        </>
                      ) : (
                        botStatus === 'active' ? 'Stop Bot' : 'Start Bot'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card className="h-full">
                  <CardContent className="space-y-4">
                    <Typography variant="h6">Wallet Balance</Typography>
                    <Box className="flex items-baseline gap-2">
                      <Typography variant="h4" className="font-bold">
                        {walletBalance !== null ? walletBalance.toFixed(4) : '---'}
                      </Typography>
                      <Typography variant="subtitle1" color="text.secondary">
                        SOL
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card className="h-full">
                  <CardContent className="space-y-4">
                    <Typography variant="h6">Trading Summary</Typography>
                    <Box className="grid grid-cols-2 gap-4">
                      <Box>
                        <Typography variant="body2" color="text.secondary">Total Trades</Typography>
                        <Typography variant="h6">{trades.length}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Success Rate</Typography>
                        <Typography variant="h6">
                          {trades.length > 0
                            ? `${((trades.filter(t => t.status === 'completed').length / trades.length) * 100).toFixed(1)}%`
                            : '---'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card>
                  <CardContent className="space-y-4">
                    <Box className="flex justify-between items-center mb-4">
                      <Typography variant="h6">Trading History</Typography>
                      {trades.length > 0 && (
                        <Button variant="text" size="small">
                          Export History
                        </Button>
                      )}
                    </Box>
                    {trades.length === 0 ? (
                      <Alert severity="info">
                        No trades executed yet
                      </Alert>
                    ) : (
                      <Box className="space-y-2">
                        {trades.map((trade) => (
                          <Card key={trade.id} variant="outlined" className="hover:bg-gray-50 transition-colors">
                            <CardContent className="flex justify-between items-center p-4">
                              <Box className="flex gap-4 items-center">
                                <Box className={`w-2 h-2 rounded-full ${
                                  trade.type === 'buy' ? 'bg-green-500' : 'bg-red-500'
                                }`} />
                                <Box>
                                  <Typography variant="subtitle2" color="text.secondary">
                                    {new Date(trade.timestamp).toLocaleString()}
                                  </Typography>
                                  <Typography className="font-medium">
                                    {trade.type.toUpperCase()} {trade.amount} @ {trade.price} SOL
                                  </Typography>
                                </Box>
                              </Box>
                              <Typography
                                variant="body2"
                                className="px-2 py-1 rounded-full"
                                sx={{
                                  color: (theme: Theme) =>
                                    trade.status === 'completed'
                                      ? theme.palette.success.main
                                      : trade.status === 'failed'
                                      ? theme.palette.error.main
                                      : theme.palette.warning.main,
                                  bgcolor: (theme: Theme) =>
                                    `${trade.status === 'completed'
                                      ? theme.palette.success.main
                                      : trade.status === 'failed'
                                      ? theme.palette.error.main
                                      : theme.palette.warning.main}20`
                                } as SxProps<Theme>}
                              >
                                {trade.status.toUpperCase()}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          <Box className="flex gap-4 mt-6">
            <Button
              variant="outlined"
              onClick={handleBack}
              size="large"
              className="flex-1"
            >
              Back to Wallet Setup
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
