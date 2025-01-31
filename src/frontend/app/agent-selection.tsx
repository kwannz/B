import React from 'react';
import { Box, Typography, Button, Grid, Card, CardContent } from '@mui/material';
import { useRouter } from 'next/router';
import { useAddress } from "@thirdweb-dev/react";

const AgentSelection: React.FC = () => {
  const router = useRouter();
  const address = useAddress();

  if (!address) {
    router.push('/login');
    return null;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Select Your Agent
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Trading Agent
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Automated trading with customizable strategies and risk management.
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => router.push('/trading-agent')}
                fullWidth
              >
                Select Trading Agent
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                DeFi Agent
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Automated DeFi operations with yield optimization and liquidity management.
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => router.push('/defi-agent')}
                fullWidth
              >
                Select DeFi Agent
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AgentSelection;
