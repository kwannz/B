'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Box, Button, Typography, Chip, Tooltip } from '@mui/material';
import { useState, useEffect } from 'react';
import { truncateAddress } from '@/app/utils/format';

interface WalletBalance {
  sol: number;
  usdt: number;
}

export default function WalletConnect() {
  const { connected, publicKey, disconnect } = useWallet();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBalance = async () => {
      if (connected && publicKey) {
        setIsLoading(true);
        try {
          // 这里应该调用实际的API来获取余额
          const response = await fetch(`/api/wallet/balance/${publicKey.toString()}`);
          const data = await response.json();
          setBalance(data);
        } catch (error) {
          console.error('获取钱包余额失败:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setBalance(null);
      }
    };

    fetchBalance();
  }, [connected, publicKey]);

  if (connected && publicKey) {
    return (
      <Box className="flex items-center gap-4">
        <Box>
          <Tooltip title={publicKey.toString()}>
            <Typography variant="body2" color="text.secondary" className="cursor-help">
              钱包地址: {truncateAddress(publicKey.toString())}
            </Typography>
          </Tooltip>
          {balance && (
            <Box className="flex gap-2 mt-1">
              <Chip
                label={`${balance.sol.toFixed(4)} SOL`}
                size="small"
                color="primary"
              />
              <Chip
                label={`${balance.usdt.toFixed(2)} USDT`}
                size="small"
                color="secondary"
              />
            </Box>
          )}
          {isLoading && (
            <Typography variant="caption" color="text.secondary">
              加载余额中...
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          onClick={() => disconnect()}
        >
          断开连接
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <WalletMultiButton className="!bg-primary-600 !text-white !rounded-lg !px-4 !py-2 !font-medium !text-sm hover:!bg-primary-700" />
      <Typography variant="caption" color="text.secondary" className="block mt-1">
        连接钱包以开始交易
      </Typography>
    </Box>
  );
}
