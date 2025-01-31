'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Button, Alert, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAddress } from "@thirdweb-dev/react";

export default function BotIntegration() {
  const router = useRouter();
  const address = useAddress();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');

  useEffect(() => {
    const initializeBot = async () => {
      try {
        // API call will be implemented here
        await new Promise(resolve => setTimeout(resolve, 2000));
        setBotStatus('ready');
      } catch (err) {
        setError('Failed to initialize bot. Please try again.');
        setBotStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    if (address) {
      initializeBot();
    }
  }, [address]);

  const handleContinue = () => {
    router.push('/wallet-creation');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Bot Integration
      </Typography>
      <Card>
        <CardContent>
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
            <>
              <Typography variant="h6" gutterBottom>
                Status: {botStatus === 'ready' ? 'Ready' : 'Error'}
              </Typography>
              {botStatus === 'ready' && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleContinue}
                  fullWidth
                >
                  Continue to Wallet Creation
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
