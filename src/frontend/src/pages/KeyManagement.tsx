import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Alert, CircularProgress, Button, Paper } from '@mui/material';
import apiClient from '../api/client';

interface LocationState {
  botId: string;
}

interface WalletData {
  address: string;
  private_key: string;
  balance: number;
}

const KeyManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { botId } = location.state as LocationState;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  useEffect(() => {
    const createWallet = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.post('/api/v1/wallets', { bot_id: botId });
        setWalletData(response);
      } catch (error) {
        console.error('Failed to create wallet:', error);
        setError('Failed to create wallet. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (botId) {
      createWallet();
    } else {
      setError('Missing bot ID');
      setLoading(false);
    }
  }, [botId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>Wallet Management</Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {walletData && (
        <Box>
          <Alert severity="warning" sx={{ mb: 4 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
              IMPORTANT: Store your private key securely!
            </Typography>
            <Typography variant="body2">
              • This is the only time you'll see the private key
              <br />
              • Save it in a secure location
              <br />
              • Never share it with anyone
            </Typography>
          </Alert>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Wallet Details</Typography>
            <Typography sx={{ mb: 1 }}>
              <strong>Address:</strong> {walletData.address}
            </Typography>
            <Typography sx={{ mb: 1 }}>
              <strong>Balance:</strong> {walletData.balance} SOL
            </Typography>
            
            {!showPrivateKey ? (
              <Button 
                variant="contained" 
                color="warning"
                onClick={() => setShowPrivateKey(true)}
                sx={{ mt: 2 }}
              >
                Show Private Key
              </Button>
            ) : (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ mb: 1 }}><strong>Private Key:</strong></Typography>
                <Paper 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.100',
                    wordBreak: 'break-all'
                  }}
                >
                  {walletData.private_key}
                </Paper>
              </Box>
            )}
          </Paper>

          <Button
            variant="contained"
            onClick={() => navigate('/trading-dashboard', { state: { botId } })}
            sx={{ mt: 2 }}
          >
            Continue to Trading Dashboard
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default KeyManagement;
