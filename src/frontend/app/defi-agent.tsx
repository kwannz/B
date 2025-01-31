import React from 'react';
import { Box, Typography, Grid, Card, CardContent } from '@mui/material';
import { useAddress } from "@thirdweb-dev/react";
import { useRouter } from 'next/router';
import AgentStatus from '../components/AgentStatus';

const DefiAgent: React.FC = () => {
  const router = useRouter();
  const address = useAddress();

  if (!address) {
    router.push('/login');
    return null;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        DeFi Agent Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <AgentStatus />
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Yield Metrics
              </Typography>
              {/* Yield metrics will be added here */}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Pools
              </Typography>
              {/* Active pools will be added here */}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DefiAgent;
