import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import apiClient from '../api/client';

interface LocationState {
  agentId: string;
  strategyId: string;
}

interface BotStatus {
  id: string;
  status: string;
  agent_id: string;
  strategy_id: string;
  last_updated: string;
}

const BotIntegration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { agentId, strategyId } = location.state as LocationState;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);

  const createBot = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.post('/api/v1/bots', {
        agent_id: agentId,
        strategy_id: strategyId
      });
      setBotStatus(response);
      navigate('/key-management', { state: { botId: response.id } });
    } catch (error) {
      console.error('Failed to create bot:', error);
      setError('Failed to create bot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!agentId || !strategyId) {
      setError('Missing required agent or strategy information');
      setLoading(false);
      return;
    }
    createBot();
  }, [agentId, strategyId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>Bot Integration</Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {botStatus && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="success" sx={{ mb: 2 }}>Bot successfully created!</Alert>
          <Typography variant="h6" sx={{ mb: 1 }}>Bot Details:</Typography>
          <Typography>ID: {botStatus.id}</Typography>
          <Typography>Status: {botStatus.status}</Typography>
          <Typography>Last Updated: {new Date(botStatus.last_updated).toLocaleString()}</Typography>
          
          <Button
            variant="contained"
            onClick={() => navigate('/key-management', { state: { botId: botStatus.id } })}
            sx={{ mt: 2 }}
          >
            Continue to Key Management
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default BotIntegration;
