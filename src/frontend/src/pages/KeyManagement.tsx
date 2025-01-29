import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

const KeyManagement = () => {
  const [walletData, setWalletData] = useState({
    address: '',
    privateKey: ''
  });

  useEffect(() => {
    setWalletData({
      address: 'test-wallet-address',
      privateKey: 'test-private-key'
    });
  }, []);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4">Generated Wallet</Typography>
      <Typography>Address: {walletData.address}</Typography>
      <Typography>Private Key: {walletData.privateKey}</Typography>
    </Box>
  );
};

export default KeyManagement;
