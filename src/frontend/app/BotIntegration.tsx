import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import apiClient, { StrategyResponse } from '../api/client';
import { useNavigate } from 'react-router-dom';

const BotIntegration: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);

  const steps = [
    'Validating Strategy',
    'Configuring Bot',
    'Testing Connections',
    'Integration Complete',
  ];

  useEffect(() => {
    const integrateBot = async () => {
      try {
        const strategyId = localStorage.getItem('currentStrategyId');
        if (!strategyId) {
          throw new Error('No strategy selected');
        }

        // Step 1: Validate Strategy
        const strategyResponse = await apiClient.getStrategies();
        if (!strategyResponse.success || !strategyResponse.data) {
          throw new Error('Failed to validate strategy');
        }
        
        const currentStrategy = strategyResponse.data.find(s => s.id === strategyId);
        if (!currentStrategy) {
          throw new Error('Strategy not found');
        }
        
        setStrategy(currentStrategy);
        setActiveStep(1);

        // Step 2: Configure Bot
        const startResponse = await apiClient.startAgent('trading');
        if (!startResponse.success) {
          throw new Error('Failed to start trading agent');
        }
        setActiveStep(2);

        // Step 3: Test Connections
        const statusResponse = await apiClient.getAgentStatus('trading');
        if (!statusResponse.success || statusResponse.data?.status !== 'running') {
          throw new Error('Failed to verify agent status');
        }
        setActiveStep(3);

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bot integration failed. Please try again.');
        setIsLoading(false);
      }
    };

    integrateBot();
  }, []);

  const handleContinue = () => {
    navigate('/key-management');
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Bot Integration
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ textAlign: 'center', py: 3 }}>
          {isLoading ? (
            <Box>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography>
                {steps[activeStep]}...
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="h6" gutterBottom color="success.main">
                Bot Integration Complete!
              </Typography>
              <Typography color="textSecondary" sx={{ mb: 3 }}>
                Your trading bot has been successfully configured with strategy: {strategy?.name}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Strategy Type: {strategy?.type}
                {strategy?.parameters && (
                  <Box component="pre" sx={{ mt: 1, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    {JSON.stringify(strategy.parameters, null, 2)}
                  </Box>
                )}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleContinue}
              >
                Continue to Key Management
              </Button>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default BotIntegration;
