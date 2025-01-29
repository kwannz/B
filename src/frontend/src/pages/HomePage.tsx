import { Box, Typography, Button, Grid, Card, CardContent, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAddress, useBalance } from "@thirdweb-dev/react";
import type { Position } from '../lib/mock-data';
import { mockPerformanceData, mockPositionsData } from '../lib/mock-data';
import AgentStatus from '../components/AgentStatus';

const HomePage = () => {
  const navigate = useNavigate();
  const address = useAddress();
  const { data: balance, isLoading: isBalanceLoading } = useBalance();
  const isAuthenticated = !!address;

  if (isBalanceLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{ 
        textAlign: 'center', 
        mt: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2
      }}>
        <Typography variant="h4" gutterBottom>
          Welcome to Trading Bot Platform
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, maxWidth: '600px' }}>
          Connect your wallet to access our intelligent trading agents and start managing your portfolio
        </Typography>
        <Button 
          variant="contained" 
          color="primary"
          size="large"
          onClick={() => navigate('/login')}
          sx={{ minWidth: '200px' }}
        >
          Connect Wallet
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Trading Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Performance Summary</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography color="text.secondary">Total PnL</Typography>
                  <Typography variant="h6" color={mockPerformanceData.totalPnl >= 0 ? 'success.main' : 'error.main'}>
                    ${mockPerformanceData.totalPnl.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography color="text.secondary">Daily PnL</Typography>
                  <Typography variant="h6" color={mockPerformanceData.dailyPnl >= 0 ? 'success.main' : 'error.main'}>
                    ${mockPerformanceData.dailyPnl.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography color="text.secondary">Total Trades</Typography>
                  <Typography variant="h6">{mockPerformanceData.trades.total}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography color="text.secondary">Success Rate</Typography>
                  <Typography variant="h6">
                    {((mockPerformanceData.trades.successful / mockPerformanceData.trades.total) * 100).toFixed(1)}%
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Active Positions</Typography>
              {mockPositionsData.map((position: Position) => (
                <Box key={position.id} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1">
                    {position.symbol} ({position.side.toUpperCase()})
                  </Typography>
                  <Typography variant="body2" color={position.pnl >= 0 ? 'success.main' : 'error.main'}>
                    PnL: ${position.pnl.toFixed(2)} ({position.pnlPercentage.toFixed(2)}%)
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <AgentStatus />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button 
              variant="outlined" 
              onClick={() => navigate('/agent-selection')}
            >
              Agent Selection
            </Button>
            <Button 
              variant="contained" 
              onClick={() => navigate('/trading-agent')}
            >
              Trading Dashboard
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default HomePage;
