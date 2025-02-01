'use client';

import { Box, Typography, Card, CardContent } from '@mui/material';
import { Trade } from '@/app/types/trade';

interface TradingHistoryProps {
  trades: Trade[];
}

export default function TradingHistory({ trades }: TradingHistoryProps) {
  return (
    <Box className="space-y-2">
      {trades.map((trade) => (
        <Card key={trade.id} variant="outlined">
          <CardContent className="flex justify-between items-center">
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                {new Date(trade.timestamp).toLocaleString()}
              </Typography>
              <Typography>
                {trade.type.toUpperCase()} {trade.amount} @ {trade.price} SOL
              </Typography>
            </Box>
            <Typography
              color={
                trade.status === 'completed'
                  ? 'success.main'
                  : trade.status === 'failed'
                  ? 'error.main'
                  : 'warning.main'
              }
            >
              {trade.status.toUpperCase()}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
