import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Button, TextField, Typography, Alert, CircularProgress } from '@mui/material';
import apiClient from '../api/client';

interface LocationState {
  agentType: string;
  agentId: string;
}

interface StrategyForm {
  name: string;
  description: string;
  type: string;
  parameters: Record<string, any>;
  strategy: string;
}

const StrategyCreation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { agentType, agentId } = location.state as LocationState;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<StrategyForm>({
    name: '',
    description: '',
    type: agentType,
    parameters: {},
    strategy: ''
  });

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Strategy name is required');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Strategy description is required');
      return false;
    }
    if (!formData.strategy.trim()) {
      setError('Strategy implementation is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/api/v1/strategies', formData);
      navigate('/bot-integration', { 
        state: { 
          agentId,
          strategyId: response.id 
        }
      });
    } catch (error) {
      console.error('Failed to create strategy:', error);
      setError('Failed to create strategy. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>Create Strategy</Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <Box sx={{ mt: 4 }}>
        <TextField
          required
          fullWidth
          label="Strategy Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          sx={{ mb: 2 }}
        />
        <TextField
          required
          fullWidth
          multiline
          rows={3}
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          sx={{ mb: 2 }}
        />
        <TextField
          required
          fullWidth
          multiline
          rows={4}
          label="Strategy Implementation"
          value={formData.strategy}
          onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
          sx={{ mb: 2 }}
        />
        <Button 
          type="submit" 
          variant="contained" 
          disabled={loading}
          sx={{ mt: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Create Strategy'}
        </Button>
      </Box>
    </Box>
  );
};

export default StrategyCreation;
