'use client';

import { Box, Typography, Button, Alert } from '@mui/material';
import { useState } from 'react';

interface WalletDisplayProps {
  wallet: {
    address: string;
    private_key: string;
    balance: number;
  };
  onBack: () => void;
  onContinue: () => void;
}

export default function WalletDisplay({ wallet, onBack, onContinue }: WalletDisplayProps) {
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  return (
    <Box className="space-y-6">
      <Alert severity="warning">
        Important: Save your wallet information securely. The private key will only be shown once.
      </Alert>

      <Box className="space-y-2">
        <Typography variant="subtitle2" color="text.secondary">
          Wallet Address
        </Typography>
        <Typography className="break-all font-mono p-4 bg-gray-100 rounded">
          {wallet.address}
        </Typography>
      </Box>

      <Box className="space-y-2">
        <Typography variant="subtitle2" color="text.secondary">
          Initial Balance
        </Typography>
        <Typography variant="h6">
          {wallet.balance.toFixed(4)} SOL
        </Typography>
      </Box>

      <Box className="space-y-4">
        <Button
          variant="outlined"
          fullWidth
          onClick={() => setShowPrivateKey(!showPrivateKey)}
        >
          {showPrivateKey ? 'Hide' : 'Show'} Private Key
        </Button>
        {showPrivateKey && (
          <Box className="p-4 bg-gray-100 rounded">
            <Typography className="break-all font-mono">
              {wallet.private_key}
            </Typography>
          </Box>
        )}
      </Box>

      <Box className="flex gap-4">
        <Button
          variant="outlined"
          onClick={onBack}
          size="large"
          className="flex-1"
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onContinue}
          size="large"
          className="flex-1"
        >
          Continue to Dashboard
        </Button>
      </Box>
    </Box>
  );
}
