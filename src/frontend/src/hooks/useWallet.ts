import { useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import useWalletStore from '../store/useWalletStore';
import { toast } from '../components/ui/use-toast';

export const useWallet = () => {
  const {
    isAuthenticated,
    walletAddress,
    balance,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    checkWalletBalance,
  } = useWalletStore();

  const handleConnect = useCallback(async (publicKey: PublicKey, adapter: any) => {
    try {
      await connectWallet(publicKey, adapter);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect wallet',
      });
    }
  }, [connectWallet]);

  const handleDisconnect = useCallback(() => {
    try {
      disconnectWallet();
      toast({
        title: 'Disconnected',
        description: 'Your wallet has been disconnected',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to disconnect wallet',
      });
    }
  }, [disconnectWallet]);

  const handleCheckBalance = useCallback(async (publicKey: PublicKey, adapter: any) => {
    try {
      return await checkWalletBalance(publicKey, adapter);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to check wallet balance',
      });
      return 0;
    }
  }, [checkWalletBalance]);

  return {
    isAuthenticated,
    walletAddress,
    balance,
    isConnecting,
    error,
    connect: handleConnect,
    disconnect: handleDisconnect,
    checkBalance: handleCheckBalance,
  };
};
