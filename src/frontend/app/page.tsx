'use client';

import React from 'react';
import { Box, Typography, Button, Grid, Card, CardContent, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAddress, useBalance, ConnectWallet } from "@thirdweb-dev/react";
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
          textAlign: 'center'
        }}
      >
        <Typography variant="h3" gutterBottom>
          Welcome to Solana Trading Bot
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: '600px' }}>
          Automated trading with customizable strategies, real-time market analysis, and secure wallet integration
        </Typography>
        <Grid container spacing={3} sx={{ maxWidth: '800px', mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Smart Trading
                </Typography>
                <Typography variant="body2">
                  AI-powered market analysis and automated trading strategies
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Real-time Metrics
                </Typography>
                <Typography variant="body2">
                  Live performance tracking and portfolio management
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Secure Trading
                </Typography>
                <Typography variant="body2">
                  Built on Solana with wallet-based authentication
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ConnectWallet
            theme="dark"
            btnTitle="Connect Wallet"
            modalTitle="Select Your Wallet"
          />
          <Button
            variant="outlined"
            color="primary"
            size="large"
            href="https://github.com/kwanRoshi/tradingbot#readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn More
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h4" gutterBottom>
              Trading Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Connected Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <AgentStatus />
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Wallet Balance
              </Typography>
              {isBalanceLoading ? (
                <CircularProgress size={20} />
              ) : (
                <Typography variant="h4">
                  {balance?.displayValue} {balance?.symbol}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total PnL
                </Typography>
                <Typography variant="h5" color={performance.totalPnl >= 0 ? 'success.main' : 'error.main'}>
                  ${performance.totalPnl.toFixed(2)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Success Rate
                </Typography>
                <Typography variant="h5">
                  {((performance.trades.successful / performance.trades.total) * 100).toFixed(1)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Positions
              </Typography>
              {positions.length === 0 ? (
                <Typography color="text.secondary">No active positions</Typography>
              ) : (
                positions.map((position, index) => (
                  <Box key={index} sx={{ mb: index !== positions.length - 1 ? 2 : 0 }}>
                    <Typography variant="subtitle2">
                      {position.symbol} ({position.side})
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      PnL: ${position.pnl.toFixed(2)}
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              href="/agent-selection"
            >
              Configure New Agent
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="large"
              href="/dashboard"
            >
              View Full Dashboard
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
