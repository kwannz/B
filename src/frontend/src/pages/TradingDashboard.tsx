import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

const TradingDashboard = () => {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    setTrades([{
      id: '1',
      type: 'BUY',
      amount: 1.5,
      price: 50000,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED'
    }]);
  }, []);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4">Trading Dashboard</Typography>
      <Typography variant="h6" sx={{ mt: 4 }}>Trading History</Typography>
      {trades.map(trade => (
        <Box key={trade.id} sx={{ mt: 2 }}>
          <Typography>Type: {trade.type}</Typography>
          <Typography>Status: {trade.status}</Typography>
        </Box>
      ))}
    </Box>
  );
};

export default TradingDashboard;
