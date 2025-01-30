import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useAddress } from "@thirdweb-dev/react";

const KeyManagement: React.FC = () => {
  const router = useRouter();
  const address = useAddress();
  const [walletInfo, setWalletInfo] = useState({
    address: '',
    privateKey: '',
  });
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const generateWallet = async () => {
      try {
        // Wallet generation logic will be implemented here
        setWalletInfo({
          address: '0x1234...5678',
          privateKey: '0xabcd...efgh',
        });
      } catch (err) {
        setError('Failed to generate wallet. Please try again.');
      }
    };

    if (address) {
      generateWallet();
    }
  }, [address]);

  if (!address) {
    router.push('/login');
    return null;
  }

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletInfo.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = () => {
    router.push('/trading-agent');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Key Management
      </Typography>
      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {error && (
              <Grid item xs={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}
            {copied && (
              <Grid item xs={12}>
                <Alert severity="success">Address copied to clipboard!</Alert>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Wallet Address"
                value={walletInfo.address}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleCopyAddress}>
                        <ContentCopyIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Private Key"
                type={showPrivateKey ? 'text' : 'password'}
                value={walletInfo.privateKey}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPrivateKey(!showPrivateKey)}>
                        {showPrivateKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="error" gutterBottom>
                Important: Save your private key securely. It will not be shown again.
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleContinue}
                fullWidth
              >
                Continue to Trading Dashboard
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default KeyManagement;
