import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import apiClient, { WalletResponse } from '../api/client';

interface DashboardProps {
  agentType: 'trading' | 'defi';
}

const Dashboard: React.FC<DashboardProps> = ({ agentType }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletResponse | null>(null);
  const [agentStatus, setAgentStatus] = useState<string>('stopped');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const walletAddress = localStorage.getItem('walletAddress');
        if (!walletAddress) {
          throw new Error('No wallet connected');
        }

        const [walletResponse, agentResponse] = await Promise.all([
          apiClient.getWalletTransactions(walletAddress),
          apiClient.getAgentStatus(agentType)
        ]);

        if (walletResponse.success && walletResponse.data) {
          setWalletData({
            address: walletAddress,
            publicKey: walletAddress,
            balance: '0',
            transactions: walletResponse.data
          });
        }

        if (agentResponse.success && agentResponse.data) {
          setAgentStatus(agentResponse.data.status);
        }
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [agentType]);

  const handleStartAgent = async () => {
    try {
      const response = await apiClient.startAgent(agentType);
      if (response.success) {
        setAgentStatus('running');
      } else {
        setError(response.error || 'Failed to start agent');
      }
    } catch (err) {
      setError('Failed to start agent');
    }
  };

  const handleStopAgent = async () => {
    try {
      const response = await apiClient.stopAgent(agentType);
      if (response.success) {
        setAgentStatus('stopped');
      } else {
        setError(response.error || 'Failed to stop agent');
      }
    } catch (err) {
      setError('Failed to stop agent');
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {agentType === 'trading' ? 'Trading Agent' : 'DeFi Agent'} Dashboard
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Agent Status */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Agent Status
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography
                  sx={{
                    color:
                      agentStatus === 'running'
                        ? 'success.main'
                        : agentStatus === 'error'
                        ? 'error.main'
                        : 'text.secondary',
                    mr: 2,
                  }}
                >
                  {agentStatus.toUpperCase()}
                </Typography>
                <Button
                  variant="contained"
                  color={agentStatus === 'running' ? 'error' : 'primary'}
                  onClick={agentStatus === 'running' ? handleStopAgent : handleStartAgent}
                >
                  {agentStatus === 'running' ? 'Stop Agent' : 'Start Agent'}
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Wallet Info */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Wallet Information
              </Typography>
              {walletData && (
                <>
                  <Typography variant="body2" color="textSecondary">
                    Address: {walletData.address}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Balance: {walletData.balance} SOL
                  </Typography>
                </>
              )}
            </Paper>
          </Grid>

          {/* Transaction History */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Transaction History
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Hash</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {walletData?.transactions.map((tx) => (
                      <TableRow key={tx.hash}>
                        <TableCell>{tx.hash}</TableCell>
                        <TableCell>{tx.type}</TableCell>
                        <TableCell>{tx.amount}</TableCell>
                        <TableCell>{tx.status}</TableCell>
                        <TableCell>{new Date(tx.timestamp).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default Dashboard;
