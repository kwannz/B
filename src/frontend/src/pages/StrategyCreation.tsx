import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import apiClient, { StrategyResponse } from '../api/client';
import { useNavigate } from 'react-router-dom';

const StrategyCreation: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    strategyName: '',
    promotionWords: '',
    tradingPair: 'SOL/USDT',
    timeframe: '1h',
    riskLevel: 'medium',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.createStrategy(formData);
      
      if (response.success && response.data) {
        // Store strategy ID in localStorage for the bot integration step
        localStorage.setItem('currentStrategyId', response.data.id);
        navigate('/bot-integration');
      } else {
        setError(response.error || 'Failed to create strategy. Please try again.');
      }
    } catch (err) {
      setError('Failed to create strategy. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | { value: unknown }>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Create Trading Strategy
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Strategy Name"
                value={formData.strategyName}
                onChange={handleChange('strategyName')}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Promotion Words"
                value={formData.promotionWords}
                onChange={handleChange('promotionWords')}
                multiline
                rows={3}
                required
                helperText="Enter keywords or phrases for strategy promotion"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Trading Pair</InputLabel>
                <Select
                  value={formData.tradingPair}
                  label="Trading Pair"
                  onChange={handleChange('tradingPair')}
                >
                  <MenuItem value="SOL/USDT">SOL/USDT</MenuItem>
                  <MenuItem value="SOL/USDC">SOL/USDC</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Timeframe</InputLabel>
                <Select
                  value={formData.timeframe}
                  label="Timeframe"
                  onChange={handleChange('timeframe')}
                >
                  <MenuItem value="5m">5 minutes</MenuItem>
                  <MenuItem value="15m">15 minutes</MenuItem>
                  <MenuItem value="1h">1 hour</MenuItem>
                  <MenuItem value="4h">4 hours</MenuItem>
                  <MenuItem value="1d">1 day</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Risk Level</InputLabel>
                <Select
                  value={formData.riskLevel}
                  label="Risk Level"
                  onChange={handleChange('riskLevel')}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Strategy Description"
                value={formData.description}
                onChange={handleChange('description')}
                multiline
                rows={4}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Create Strategy'
                )}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default StrategyCreation;
