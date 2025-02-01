'use client';

import { Box, Typography, CircularProgress, Button, Alert, Card, CardContent, Chip } from '@mui/material';

interface BotStatusProps {
  isProcessing: boolean;
  error: string | null;
  botId: string | null;
  onBack: () => void;
  onContinue: () => void;
  // 交易代理状态
  strategyType?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  tradeSize?: number;
  walletAddress?: string;
  walletBalance?: number;
  marketAnalysis?: {
    sentiment: string;
    score: number;
  };
}

export default function BotStatus({ 
  isProcessing, 
  error, 
  botId, 
  onBack, 
  onContinue,
  strategyType,
  riskLevel,
  tradeSize,
  walletAddress,
  walletBalance,
  marketAnalysis
}: BotStatusProps) {
  if (isProcessing) {
    return (
      <Box className="flex flex-col items-center gap-4 py-8">
        <CircularProgress />
        <Typography>Initializing your trading bot...</Typography>
      </Box>
    );
  }

  if (botId) {
    return (
      <Box className="space-y-4">
        <Alert severity="success">
          交易机器人创建成功!
        </Alert>

        <Card>
          <CardContent className="space-y-4">
            <Typography variant="h6">交易机器人状态</Typography>
            
            <Box className="grid grid-cols-2 gap-4">
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  策略类型
                </Typography>
                <Typography>{strategyType || '未设置'}</Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  风险等级
                </Typography>
                <Chip 
                  label={riskLevel === 'low' ? '低' : riskLevel === 'medium' ? '中' : '高'} 
                  color={riskLevel === 'low' ? 'success' : riskLevel === 'medium' ? 'warning' : 'error'}
                  size="small"
                />
              </Box>
              
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  交易规模
                </Typography>
                <Typography>{tradeSize || '未设置'}</Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  钱包地址
                </Typography>
                <Typography className="truncate">
                  {walletAddress || '未连接'}
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  钱包余额
                </Typography>
                <Typography>
                  {walletBalance ? `${walletBalance.toFixed(4)} USDT` : '未知'}
                </Typography>
              </Box>
              
              {marketAnalysis && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    市场分析
                  </Typography>
                  <Box className="flex items-center gap-2">
                    <Typography>{marketAnalysis.sentiment}</Typography>
                    <Chip 
                      label={`${(marketAnalysis.score * 100).toFixed(0)}%`}
                      color={marketAnalysis.score > 0.7 ? 'success' : marketAnalysis.score > 0.3 ? 'warning' : 'error'}
                      size="small"
                    />
                  </Box>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>

        <Box className="flex gap-4 mt-6">
          <Button
            variant="outlined"
            onClick={onBack}
            size="large"
            className="flex-1"
          >
            返回
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={onContinue}
            size="large"
            className="flex-1"
          >
            继续设置钱包
          </Button>
        </Box>
      </Box>
    );
  }

  return null;
}
