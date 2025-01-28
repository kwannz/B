import React from 'react';
import { Box, Typography } from '@mui/material';

interface DashboardProps {
  agentType: 'trading' | 'defi';
}

export default function Dashboard({ agentType }: DashboardProps) {
  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        {agentType === 'trading' ? 'Trading Dashboard' : 'DeFi Dashboard'}
      </Typography>
    </Box>
  );
}
