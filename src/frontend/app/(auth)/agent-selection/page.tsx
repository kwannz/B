'use client';

import React from 'react';
import { Box, Typography, Grid, Card, CardContent, Button } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAddress } from "@thirdweb-dev/react";

export default function AgentSelection() {
  const router = useRouter();
  const address = useAddress();

  const handleAgentSelect = (agentType: 'trading' | 'defi') => {
    router.push(`/strategy-creation?type=${agentType}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Select Your Agent
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trading Agent
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Automated trading with customizable strategies and real-time market analysis
              </Typography>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={() => handleAgentSelect('trading')}
              >
                Select Trading Agent
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                DeFi Agent
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Automated DeFi operations with yield optimization and liquidity management
              </Typography>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={() => handleAgentSelect('defi')}
              >
                Select DeFi Agent
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
