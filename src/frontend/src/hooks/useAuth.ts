import { useWallet } from '@solana/wallet-adapter-react';
import useWalletStore from '../store/useWalletStore';

export interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | null;
  connectWithWallet: () => Promise<void>;
  disconnectWallet: () => void;
  checkWalletBalance: () => Promise<number>;
}

export const useAuthContext = (): AuthContextType => {
  const { publicKey, wallet } = useWallet();
  const {
    isAuthenticated,
    walletAddress,
    connectWallet,
    disconnectWallet,
    checkWalletBalance,
  } = useWalletStore();

  const handleConnectWallet = async () => {
    if (publicKey && wallet?.adapter) {
      await connectWallet(publicKey, wallet.adapter);
    }
  };

  return {
    isAuthenticated,
    walletAddress,
    connectWithWallet: handleConnectWallet,
    disconnectWallet,
    checkWalletBalance: () => checkWalletBalance(publicKey!, wallet?.adapter!),
  };
};
