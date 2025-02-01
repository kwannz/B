'use client';

import { Box, Typography, LinearProgress } from '@mui/material';

interface PerformanceMetricsProps {
  // 交易统计
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  winRate: number;
  // 盈亏统计
  totalProfit: number;
  totalLoss: number;
  netProfitLoss: number;
  // 持仓统计
  averageHoldingTime: number;
  maxDrawdown: number;
  // 风险指标
  sharpeRatio?: number;
  volatility?: number;
}

export default function PerformanceMetrics({
  totalTrades,
  successfulTrades,
  failedTrades,
  winRate,
  totalProfit,
  totalLoss,
  netProfitLoss,
  averageHoldingTime,
  maxDrawdown,
  sharpeRatio,
  volatility
}: PerformanceMetricsProps) {
  return (
    <Box className="space-y-6">
      <Box>
        <Typography variant="h6" className="mb-4">交易表现</Typography>
        
        <Box className="grid grid-cols-2 gap-4">
          <Box className="space-y-2">
            <Typography variant="subtitle2" color="text.secondary">
              总交易次数
            </Typography>
            <Box className="flex items-center gap-4">
              <Typography variant="body1">
                {totalTrades}
              </Typography>
              <Box className="flex-1">
                <LinearProgress
                  variant="determinate"
                  value={100}
                  className="h-2 rounded-full"
                />
              </Box>
            </Box>
          </Box>

          <Box className="space-y-2">
            <Typography variant="subtitle2" color="text.secondary">
              胜率
            </Typography>
            <Box className="flex items-center gap-4">
              <Typography variant="body1">
                {(winRate * 100).toFixed(1)}%
              </Typography>
              <Box className="flex-1">
                <LinearProgress
                  variant="determinate"
                  value={winRate * 100}
                  className="h-2 rounded-full"
                  color={winRate >= 0.5 ? "success" : "error"}
                />
              </Box>
            </Box>
          </Box>

          <Box className="space-y-2">
            <Typography variant="subtitle2" color="text.secondary">
              成功/失败交易
            </Typography>
            <Box className="flex items-center gap-4">
              <Typography variant="body1" color="success.main">
                {successfulTrades}
              </Typography>
              <Box className="flex-1">
                <LinearProgress
                  variant="determinate"
                  value={(successfulTrades / totalTrades) * 100}
                  className="h-2 rounded-full"
                />
              </Box>
              <Typography variant="body1" color="error.main">
                {failedTrades}
              </Typography>
            </Box>
          </Box>

          <Box className="space-y-2">
            <Typography variant="subtitle2" color="text.secondary">
              平均持仓时间
            </Typography>
            <Typography variant="body1">
              {averageHoldingTime.toFixed(1)} 小时
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box>
        <Typography variant="h6" className="mb-4">盈亏分析</Typography>
        
        <Box className="grid grid-cols-2 gap-4">
          <Box className="space-y-2">
            <Typography variant="subtitle2" color="text.secondary">
              总盈利/亏损
            </Typography>
            <Box className="flex items-center gap-4">
              <Typography variant="body1" color="success.main">
                +{totalProfit.toFixed(2)} USDT
              </Typography>
              <Box className="flex-1">
                <LinearProgress
                  variant="determinate"
                  value={(totalProfit / (totalProfit + Math.abs(totalLoss))) * 100}
                  className="h-2 rounded-full"
                />
              </Box>
              <Typography variant="body1" color="error.main">
                -{Math.abs(totalLoss).toFixed(2)} USDT
              </Typography>
            </Box>
          </Box>

          <Box className="space-y-2">
            <Typography variant="subtitle2" color="text.secondary">
              净盈亏
            </Typography>
            <Typography 
              variant="body1" 
              color={netProfitLoss >= 0 ? "success.main" : "error.main"}
            >
              {netProfitLoss >= 0 ? "+" : ""}{netProfitLoss.toFixed(2)} USDT
            </Typography>
          </Box>

          <Box className="space-y-2">
            <Typography variant="subtitle2" color="text.secondary">
              最大回撤
            </Typography>
            <Typography variant="body1" color="error.main">
              {(maxDrawdown * 100).toFixed(1)}%
            </Typography>
          </Box>

          {(sharpeRatio !== undefined && volatility !== undefined) && (
            <Box className="space-y-2">
              <Typography variant="subtitle2" color="text.secondary">
                风险指标
              </Typography>
              <Box className="space-y-1">
                <Typography variant="body2">
                  夏普比率: {sharpeRatio.toFixed(2)}
                </Typography>
                <Typography variant="body2">
                  波动率: {(volatility * 100).toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
