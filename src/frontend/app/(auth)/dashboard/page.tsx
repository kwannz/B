'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Alert, CircularProgress } from '@mui/material';
import { useAddress } from "@thirdweb-dev/react";
import AgentStatus from '@/components/AgentStatus';

interface TradingHistory {
  timestamp: string;
  action: string;
  amount: number;
  status: string;
}

export default function Dashboard() {
  const address = useAddress();
  const [history, setHistory] = useState<TradingHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTradingHistory = async () => {
      try {
        // API call will be implemented here
        const mockHistory = [
          { timestamp: '2024-02-20 10:00', action: 'BUY', amount: 1.5, status: 'completed' },
          { timestamp: '2024-02-20 11:30', action: 'SELL', amount: 0.5, status: 'completed' },
        ];
        setHistory(mockHistory);
      } catch (err) {
        setError('Failed to fetch trading history');
      } finally {
        setIsLoading(false);
      }
    };

    if (address) {
      fetchTradingHistory();
    }
  }, [address]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Trading Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <AgentStatus />
        </Grid>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trading History
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                history.map((trade, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Typography variant="body1">
                      {trade.timestamp} - {trade.action} {trade.amount} SOL ({trade.status})
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
