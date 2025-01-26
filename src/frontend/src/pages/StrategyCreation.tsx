import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  SelectChangeEvent,
} from '@mui/material';
import apiClient, { StrategyResponse } from '../api/client';

export interface StrategyCreationProps {}

// Using StrategyResponse from api/client
interface StrategyFormData {
  name: string;
  promotion_words: string;
  trading_pair: string;
  timeframe: string;
  risk_level: string;
  description: string;
}

const StrategyCreation: React.FC<StrategyCreationProps> = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<StrategyFormData>({
    name: '',
    promotion_words: '',
    trading_pair: 'SOL/USDT',
    timeframe: '1h',
    risk_level: 'medium',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const strategyData = {
        name: formData.name,
        promotion_words: formData.promotion_words,
        trading_pair: formData.trading_pair,
        timeframe: formData.timeframe,
        risk_level: formData.risk_level,
        description: formData.description
      };
      
      const response = await apiClient.createStrategy(strategyData);
      
      if (response.success && response.data) {
        // Store strategy ID in localStorage for the bot integration step
        localStorage.setItem('currentStrategyId', response.data.id);
        navigate('/bot-integration');
      } else {
        setError(response.error || 'Failed to create strategy. Please try again.');
      }
    } catch (err) {
      console.error('Strategy creation error:', err);
      setError('Failed to create strategy. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextChange = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSelectChange = (field: string) => (
    e: SelectChangeEvent<string>
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
                value={formData.name}
                onChange={handleTextChange('name')}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Promotion Words"
                value={formData.promotion_words}
                onChange={handleTextChange('promotion_words')}
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
                  value={formData.trading_pair}
                  label="Trading Pair"
                  onChange={handleSelectChange('trading_pair')}
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
                  onChange={handleSelectChange('timeframe')}
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
                  value={formData.risk_level}
                  label="Risk Level"
                  onChange={handleSelectChange('risk_level')}
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
                onChange={handleTextChange('description')}
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

export { StrategyCreation };
export default StrategyCreation;
