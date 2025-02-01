'use client';

import { Box, Typography, Button, Alert, Chip, Card, CardContent } from '@mui/material';
import { useState } from 'react';

interface WalletDisplayProps {
  wallet: {
    address: string;
    private_key: string;
    balance: {
      sol: number;
      usdt: number;
    };
    status: 'active' | 'inactive';
    lastActivity?: string;
    tradingEnabled: boolean;
    permissions: {
      canTrade: boolean;
      canWithdraw: boolean;
      canDeposit: boolean;
    };
  };
  onBack: () => void;
  onContinue: () => void;
  onToggleTrading?: () => void;
}

export default function WalletDisplay({ wallet, onBack, onContinue, onToggleTrading }: WalletDisplayProps) {
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  return (
    <Box className="space-y-6">
      <Alert severity="warning">
        重要提示:请安全保存您的钱包信息。私钥仅显示一次。
      </Alert>

      <Card>
        <CardContent className="space-y-4">
          <Box className="flex justify-between items-center">
            <Typography variant="h6">钱包状态</Typography>
            <Chip
              label={wallet.status === 'active' ? '活跃' : '非活跃'}
              color={wallet.status === 'active' ? 'success' : 'default'}
              size="small"
            />
          </Box>

          <Box className="grid grid-cols-2 gap-4">
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                交易权限
              </Typography>
              <Box className="flex gap-2 mt-1">
                <Chip
                  label={wallet.permissions.canTrade ? '可交易' : '禁止交易'}
                  color={wallet.permissions.canTrade ? 'success' : 'error'}
                  size="small"
                />
                <Chip
                  label={wallet.tradingEnabled ? '交易已启用' : '交易已禁用'}
                  color={wallet.tradingEnabled ? 'success' : 'error'}
                  size="small"
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                资金操作
              </Typography>
              <Box className="flex gap-2 mt-1">
                <Chip
                  label={wallet.permissions.canDeposit ? '可充值' : '禁止充值'}
                  color={wallet.permissions.canDeposit ? 'success' : 'error'}
                  size="small"
                />
                <Chip
                  label={wallet.permissions.canWithdraw ? '可提现' : '禁止提现'}
                  color={wallet.permissions.canWithdraw ? 'success' : 'error'}
                  size="small"
                />
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <Box className="space-y-2">
            <Typography variant="subtitle2" color="text.secondary">
              钱包地址
            </Typography>
            <Typography className="break-all font-mono p-4 bg-gray-100 rounded">
              {wallet.address}
            </Typography>
          </Box>

          <Box className="grid grid-cols-2 gap-4">
            <Box className="space-y-2">
              <Typography variant="subtitle2" color="text.secondary">
                SOL 余额
              </Typography>
              <Typography variant="h6">
                {wallet.balance.sol.toFixed(4)} SOL
              </Typography>
            </Box>

            <Box className="space-y-2">
              <Typography variant="subtitle2" color="text.secondary">
                USDT 余额
              </Typography>
              <Typography variant="h6">
                {wallet.balance.usdt.toFixed(2)} USDT
              </Typography>
            </Box>
          </Box>

          {wallet.lastActivity && (
            <Box className="space-y-1">
              <Typography variant="subtitle2" color="text.secondary">
                最后活动时间
              </Typography>
              <Typography variant="body2">
                {new Date(wallet.lastActivity).toLocaleString('zh-CN')}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <Box className="space-y-4">
            <Button
              variant="outlined"
              fullWidth
              onClick={() => setShowPrivateKey(!showPrivateKey)}
            >
              {showPrivateKey ? '隐藏' : '显示'}私钥
            </Button>
            {showPrivateKey && (
              <Box className="space-y-2">
                <Alert severity="error" className="mb-2">
                  警告:请勿将私钥分享给任何人
                </Alert>
                <Box className="p-4 bg-gray-100 rounded">
                  <Typography className="break-all font-mono">
                    {wallet.private_key}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      <Box className="space-y-4">
        {onToggleTrading && (
          <Button
            variant="outlined"
            color={wallet.tradingEnabled ? 'error' : 'success'}
            fullWidth
            onClick={onToggleTrading}
          >
            {wallet.tradingEnabled ? '禁用交易' : '启用交易'}
          </Button>
        )}

        <Box className="flex gap-4">
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
            继续前往仪表盘
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
