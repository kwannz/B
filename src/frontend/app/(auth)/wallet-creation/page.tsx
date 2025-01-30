'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Button, Alert, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAddress } from "@thirdweb-dev/react";

interface WalletData {
  address: string;
  privateKey: string;
}

export default function WalletCreation() {
  const router = useRouter();
  const address = useAddress();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createWallet = async () => {
      try {
        // API call will be implemented here
        const mockWallet = {
          address: 'Generated SOL Address',
          privateKey: 'Generated Private Key'
        };
        setWalletData(mockWallet);
      } catch (err) {
        setError('Failed to create wallet. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    createWallet();
  }, []);

  const handleContinue = () => {
    router.push('/key-management');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Wallet Creation
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
          ) : walletData && (
            <>
              <Typography variant="h6" gutterBottom>
                Your New Wallet
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                Address: {walletData.address}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Private Key: {walletData.privateKey}
              </Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Save your private key securely. It will not be shown again.
              </Alert>
              <Button
                variant="contained"
                color="primary"
                onClick={handleContinue}
                fullWidth
              >
                Continue to Key Management
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
