'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Button, Alert, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAddress } from "@thirdweb-dev/react";

export default function KeyManagement() {
  const router = useRouter();
  const address = useAddress();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isKeyStored, setIsKeyStored] = useState(false);

  useEffect(() => {
    const verifyKeyStorage = async () => {
      try {
        // API call will be implemented here
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsKeyStored(true);
      } catch (err) {
        setError('Failed to verify key storage. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    verifyKeyStorage();
  }, []);

  const handleContinue = () => {
    router.push('/dashboard');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Key Management
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
              <Alert 
                severity={isKeyStored ? "success" : "info"}
                sx={{ mb: 2 }}
              >
                {isKeyStored 
                  ? "Private key has been securely stored for trading operations"
                  : "Storing private key for trading operations..."}
              </Alert>
              {isKeyStored && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleContinue}
                  fullWidth
                >
                  Continue to Dashboard
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
