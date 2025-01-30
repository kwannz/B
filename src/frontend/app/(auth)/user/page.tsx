'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Alert, CircularProgress, Button } from '@mui/material';
import { useAddress, useBalance } from "@thirdweb-dev/react";
import AgentStatus from '@/components/AgentStatus';

interface Trade {
  id: string;
  timestamp: string;
  symbol: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'pending' | 'completed' | 'failed';
}

interface WalletStatus {
  balance: number;
  pendingTransactions: number;
  lastTransaction: string;
  minimumRequired: number;
}

export default function UserDashboard() {
  const address = useAddress();
  const { data: balance, isLoading: isBalanceLoading } = useBalance();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // API calls will be implemented here
        const mockTrades = [
          {
            id: '1',
            timestamp: '2024-02-20 15:30:45',
            symbol: 'SOL/USDT',
            type: 'buy',
            amount: 1.5,
            price: 105.25,
            status: 'completed'
          },
          {
            id: '2',
            timestamp: '2024-02-20 15:25:12',
            symbol: 'SOL/USDT',
            type: 'sell',
            amount: 0.5,
            price: 106.75,
            status: 'completed'
          }
        ];
        const mockWalletStatus = {
          balance: 2.5,
          pendingTransactions: 1,
          lastTransaction: '2024-02-20 15:30:45',
          minimumRequired: 0.5
        };
        setTrades(mockTrades);
        setWalletStatus(mockWalletStatus);
      } catch (err) {
        setError('Failed to fetch trading data');
      } finally {
        setIsLoading(false);
      }
    };

    if (address) {
      fetchData();
      const interval = setInterval(fetchData, 15000);
      return () => clearInterval(interval);
    }
  }, [address]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Trading Dashboard
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <AgentStatus />
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Wallet Status
              </Typography>
              {isBalanceLoading ? (
                <CircularProgress size={20} />
              ) : (
                <>
                  <Typography variant="h4" gutterBottom>
                    {balance?.displayValue} {balance?.symbol}
                  </Typography>
                  {walletStatus && (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        Pending Transactions: {walletStatus.pendingTransactions}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Last Transaction: {walletStatus.lastTransaction}
                      </Typography>
                      {walletStatus.balance < walletStatus.minimumRequired && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                          Balance below minimum required ({walletStatus.minimumRequired} SOL)
                        </Alert>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Trades
              </Typography>
              {trades.length === 0 ? (
                <Typography color="text.secondary">
                  No recent trades
                </Typography>
              ) : (
                trades.map((trade) => (
                  <Box key={trade.id} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">
                      {trade.symbol} - {trade.type.toUpperCase()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Amount: {trade.amount} | Price: ${trade.price}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={
                        trade.status === 'completed' 
                          ? 'success.main' 
                          : trade.status === 'failed' 
                          ? 'error.main' 
                          : 'warning.main'
                      }
                    >
                      {trade.status.toUpperCase()}
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              href="/agent-selection"
            >
              Configure New Agent
            </Button>
            <Button
              variant="contained"
              color="primary"
              href="/strategy-creation"
            >
              Create Strategy
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
