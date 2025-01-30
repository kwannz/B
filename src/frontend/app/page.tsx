'use client';

'use client';

import React from 'react';
import { Box, Typography, Button, Grid, Card, CardContent, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAddress, useBalance } from "@thirdweb-dev/react";
import type { Position, PerformanceData } from '@/lib/mock-data';
import { mockPerformanceData, mockPositionsData } from '@/lib/mock-data';
import AgentStatus from '@/components/AgentStatus';

export default function HomePage() {
  const router = useRouter();
  const address = useAddress();
  const { data: balance, isLoading: isBalanceLoading } = useBalance();
  const isAuthenticated = !!address;
  const positions = mockPositionsData;
  const performance = mockPerformanceData;

  const handleConnectWallet = () => {
    router.push('/login');
  };

  if (!isAuthenticated) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          p: 3,
        }}
      >
        <Typography variant="h4" gutterBottom>
          Welcome to Trading Bot
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Connect your wallet to start trading
        </Typography>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleConnectWallet}
          sx={{ minWidth: '200px' }}
        >
          Connect Wallet
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard Overview
      </Typography>
      <Box component="div" sx={{ width: '100%' }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <AgentStatus />
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Performance Metrics
                </Typography>
                {isBalanceLoading ? (
                  <CircularProgress />
                ) : (
                  <Typography variant="body1">
                    Balance: {balance?.displayValue} {balance?.symbol}
                  </Typography>
                )}
                <Typography variant="body1">
                  Total PnL: ${performance.totalPnl.toFixed(2)}
                </Typography>
                <Typography variant="body1">
                  Daily PnL: ${performance.dailyPnl.toFixed(2)}
                </Typography>
                <Typography variant="body1">
                  Success Rate: {((performance.trades.successful / performance.trades.total) * 100).toFixed(1)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Active Positions
                </Typography>
                {positions.map((position, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1">
                      {position.symbol} - {position.side}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Entry: {position.entryPrice} | Mark: {position.markPrice}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
      <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          href="/agent-selection"
          component="a"
        >
          Agent Selection
        </Button>
        <Button
          variant="contained"
          href="/trading-agent"
          component="a"
        >
          Trading Dashboard
        </Button>
      </Box>
    </Box>
  );
}
