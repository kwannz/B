'use client';

import { Box, Typography, Button, Card, CardContent, Chip } from '@mui/material';

interface AgentCardProps {
  type: 'trading';
  title: string;
  description: string;
  onSelect: () => void;
  disabled?: boolean;
  // 交易代理信息
  strategyType?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  tradeSize?: number;
  performance?: {
    totalTrades: number;
    winRate: number;
    profitLoss: number;
  };
  lastUpdated?: string;
}

export default function AgentCard({ 
  type, 
  title, 
  description, 
  onSelect, 
  disabled,
  strategyType,
  riskLevel,
  tradeSize,
  performance,
  lastUpdated
}: AgentCardProps) {
  return (
    <Card className={`transition-all hover:shadow-lg ${disabled && 'opacity-50'}`}>
      <CardContent className="space-y-4">
        <Box className="flex justify-between items-start">
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
          {riskLevel && (
            <Chip 
              label={riskLevel === 'low' ? '低风险' : riskLevel === 'medium' ? '中风险' : '高风险'}
              color={riskLevel === 'low' ? 'success' : riskLevel === 'medium' ? 'warning' : 'error'}
              size="small"
            />
          )}
        </Box>

        {strategyType && (
          <Box className="space-y-1">
            <Typography variant="subtitle2" color="text.secondary">
              策略类型
            </Typography>
            <Typography variant="body2">
              {strategyType}
            </Typography>
          </Box>
        )}

        {tradeSize && (
          <Box className="space-y-1">
            <Typography variant="subtitle2" color="text.secondary">
              交易规模
            </Typography>
            <Typography variant="body2">
              {tradeSize} USDT
            </Typography>
          </Box>
        )}

        {performance && (
          <Box className="grid grid-cols-3 gap-4">
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                总交易次数
              </Typography>
              <Typography variant="body2">
                {performance.totalTrades}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                胜率
              </Typography>
              <Typography variant="body2">
                {(performance.winRate * 100).toFixed(1)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                盈亏
              </Typography>
              <Typography 
                variant="body2" 
                color={performance.profitLoss >= 0 ? 'success.main' : 'error.main'}
              >
                {performance.profitLoss >= 0 ? '+' : ''}{performance.profitLoss.toFixed(2)} USDT
              </Typography>
            </Box>
          </Box>
        )}

        {lastUpdated && (
          <Typography variant="caption" color="text.secondary">
            最后更新: {lastUpdated}
          </Typography>
        )}

        <Box className="flex justify-between items-center pt-2">
          <Button
            variant="contained"
            color="primary"
            onClick={onSelect}
            disabled={disabled}
            size="large"
          >
            Select
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/docs/${type}-agent`, '_blank');
            }}
          >
            Learn More
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
