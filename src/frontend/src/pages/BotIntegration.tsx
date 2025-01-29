import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

const BotIntegration = () => {
  const [botId, setBotId] = useState<string | null>(null);

  useEffect(() => {
    const strategyData = localStorage.getItem('strategyData');
    if (strategyData) {
      setBotId('test-bot-id');
    }
  }, []);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4">Bot Integration</Typography>
      {botId && (
        <>
          <Typography>Bot Initialized</Typography>
          <Typography>Bot ID: {botId}</Typography>
        </>
      )}
    </Box>
  );
};

export default BotIntegration;
