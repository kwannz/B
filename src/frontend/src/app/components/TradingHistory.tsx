'use client';

import { Box, Typography, Card, CardContent, Chip, Tooltip } from '@mui/material';
import { Trade } from '@/app/types/trade';

interface TradingHistoryProps {
  trades: Trade[];
  onTradeClick?: (trade: Trade) => void;
}

export default function TradingHistory({ trades, onTradeClick }: TradingHistoryProps) {
  return (
    <Box className="space-y-4">
      <Typography variant="h6">交易历史</Typography>
      {trades.map((trade) => (
        <Card 
          key={trade.id} 
          variant="outlined" 
          className={`transition-all hover:shadow-md ${onTradeClick ? 'cursor-pointer' : ''}`}
          onClick={() => onTradeClick?.(trade)}
        >
          <CardContent>
            <Box className="flex justify-between items-start">
              <Box className="space-y-1">
                <Box className="flex items-center gap-2">
                  <Chip
                    label={trade.type === 'buy' ? '买入' : '卖出'}
                    color={trade.type === 'buy' ? 'success' : 'error'}
                    size="small"
                  />
                  <Typography variant="subtitle2" color="text.secondary">
                    {new Date(trade.timestamp).toLocaleString()}
                  </Typography>
                </Box>
                <Box className="space-y-1">
                  <Typography>
                    数量: {trade.amount} SOL
                  </Typography>
                  <Typography>
                    价格: {trade.price} USDT
                  </Typography>
                  {trade.profitLoss && (
                    <Typography 
                      color={trade.profitLoss >= 0 ? 'success.main' : 'error.main'}
                    >
                      盈亏: {trade.profitLoss >= 0 ? '+' : ''}{trade.profitLoss.toFixed(2)} USDT
                    </Typography>
                  )}
                </Box>
              </Box>
              
              <Box className="text-right space-y-2">
                <Tooltip title={trade.status === 'completed' ? '交易完成' : 
                          trade.status === 'failed' ? '交易失败' : 
                          '交易处理中'}>
                  <Chip
                    label={trade.status === 'completed' ? '完成' : 
                          trade.status === 'failed' ? '失败' : 
                          '处理中'}
                    color={trade.status === 'completed' ? 'success' : 
                          trade.status === 'failed' ? 'error' : 
                          'warning'}
                    size="small"
                  />
                </Tooltip>
                {trade.reason && (
                  <Typography variant="caption" color="text.secondary" className="block">
                    {trade.reason}
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
