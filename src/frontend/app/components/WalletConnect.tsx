'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Box, Button, Typography } from '@mui/material';
import { truncateAddress } from '@/app/utils/format';

export default function WalletConnect() {
  const { connected, publicKey, disconnect } = useWallet();

  if (connected && publicKey) {
    return (
      <Box className="flex items-center gap-2">
        <Typography variant="body2" color="text.secondary">
          {truncateAddress(publicKey.toString())}
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          onClick={() => disconnect()}
        >
          Disconnect
        </Button>
      </Box>
    );
  }

  return (
    <WalletMultiButton className="!bg-primary-600 !text-white !rounded-lg !px-4 !py-2 !font-medium !text-sm hover:!bg-primary-700" />
  );
}
