import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Paper, Grid } from '@mui/material';
import { Trade } from '../types/trade';
import apiClient from '../api/client';

interface LocationState {
  botId: string;
}

interface BotStatus {
  id: string;
  status: string;
  agent_id: string;
  strategy_id: string;
  last_updated: string;
  exists: boolean;
  uptime: string;
}

const TradingDashboard = () => {
  const location = useLocation();
  const { botId } = location.state as LocationState;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);

  const fetchBotStatus = async () => {
    try {
      const response = await apiClient.get(`/api/v1/bots/${botId}/status`);
      setBotStatus(response);
    } catch (error) {
      console.error('Failed to fetch bot status:', error);
      setError('Failed to fetch bot status');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!botId) {
        setError('Missing bot ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch initial data
        await fetchBotStatus();
        const tradesResponse = await apiClient.get(`/api/v1/bots/${botId}/trades`);
        setTrades(tradesResponse.trades || []);

        // Set up polling for status updates
        const statusInterval = setInterval(fetchBotStatus, 10000);

        setLoading(false);

        return () => clearInterval(statusInterval);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError('Failed to load dashboard data');
        setLoading(false);
      }
    };

    fetchData();
  }, [botId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>Trading Dashboard</Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {botStatus && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Bot Status</Typography>
              <Typography><strong>Status:</strong> {botStatus.status}</Typography>
              <Typography><strong>Uptime:</strong> {botStatus.uptime}</Typography>
              <Typography><strong>Last Updated:</strong> {new Date(botStatus.last_updated).toLocaleString()}</Typography>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Trading History</Typography>
              {trades.length === 0 ? (
                <Alert severity="info">No trades executed yet</Alert>
              ) : (
                trades.map(trade => (
                  <Box key={trade.id} sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography><strong>Type:</strong> {trade.type}</Typography>
                    <Typography><strong>Amount:</strong> {trade.amount}</Typography>
                    <Typography><strong>Price:</strong> {trade.price}</Typography>
                    <Typography><strong>Status:</strong> {trade.status}</Typography>
                    <Typography><strong>Time:</strong> {new Date(trade.timestamp).toLocaleString()}</Typography>
                  </Box>
                ))
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default TradingDashboard;
