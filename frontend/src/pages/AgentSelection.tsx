import React from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp as TradingIcon,
  AccountBalance as DeFiIcon,
} from '@mui/icons-material';

const AgentSelection: React.FC = () => {
  const navigate = useNavigate();

  const handleAgentSelect = (agentType: 'trading' | 'defi') => {
    localStorage.setItem('selectedAgentType', agentType);
    navigate('/strategy-creation');
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          Select Your Agent
        </Typography>
        <Typography variant="body1" color="textSecondary" align="center" sx={{ mb: 4 }}>
          Choose the type of agent you want to deploy
        </Typography>

        <Grid container spacing={4} justifyContent="center">
          {/* Trading Agent Card */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  boxShadow: 6,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                <TradingIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h5" component="h2" gutterBottom>
                  Trading Agent
                </Typography>
                <Typography variant="body1" color="textSecondary">
                  Automated trading bot for cryptocurrency markets. Implements advanced
                  strategies for optimal trading performance.
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Features:
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    • Market analysis and trend detection
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    • Automated trade execution
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    • Risk management
                  </Typography>
                </Box>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => handleAgentSelect('trading')}
                >
                  Select Trading Agent
                </Button>
              </CardActions>
            </Card>
          </Grid>

          {/* DeFi Agent Card */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  boxShadow: 6,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                <DeFiIcon sx={{ fontSize: 60, color: 'secondary.main', mb: 2 }} />
                <Typography variant="h5" component="h2" gutterBottom>
                  Marketplace Strategy
                </Typography>
                <Typography variant="body1" color="textSecondary">
                  Access pre-built trading strategies from our marketplace.
                  Coming soon!
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="secondary" gutterBottom>
                    Features:
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    • Pre-built strategies
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    • Performance analytics
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    • Easy deployment
                  </Typography>
                </Box>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  disabled
                >
                  Coming Soon
                </Button>
              </CardActions>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default AgentSelection;
