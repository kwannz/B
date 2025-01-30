'use client';

import React from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useAddress } from "@thirdweb-dev/react";

const AgentStatus: React.FC = () => {
  const [status, setStatus] = React.useState<'active' | 'inactive' | 'loading'>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const address = useAddress();

  React.useEffect(() => {
    const fetchStatus = async () => {
      try {
        // API call will be implemented here
        setStatus('active');
      } catch (err) {
        setError('Failed to fetch agent status');
        setStatus('inactive');
      }
    };

    if (address) {
      fetchStatus();
    }
  }, [address]);

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: status === 'active' ? 'success.main' : 'error.main', borderRadius: 1 }}>
      <Typography variant="h6" color="white">
        Trading Agent Status: {status.toUpperCase()}
      </Typography>
    </Box>
  );
};

export default AgentStatus;
