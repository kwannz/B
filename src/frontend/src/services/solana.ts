import { PublicKey } from '@solana/web3.js';
import { toast } from '../components/ui/use-toast';

const MIN_SOL_BALANCE = 0.5;

export interface WalletAuthData {
  walletAddress: string;
  signature: string;
  message: string;
}

export const solanaService = {
  async checkBalance(publicKey: PublicKey | null, adapter: any): Promise<number> {
    if (!publicKey || !adapter) {
      return 0;
    }

    try {
      const balance = await adapter.getBalance();
      return balance.value / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('Error checking wallet balance:', error);
      toast({
        variant: "destructive",
        title: "Error checking wallet balance",
        description: "Please try again or use a different wallet",
      });
      return 0;
    }
  },

  async verifyMinimumBalance(publicKey: PublicKey | null, adapter: any): Promise<boolean> {
    const balance = await this.checkBalance(publicKey, adapter);
    if (balance < MIN_SOL_BALANCE) {
      toast({
        variant: "destructive",
        title: "Insufficient balance",
        description: `Minimum required: ${MIN_SOL_BALANCE} SOL`,
      });
      return false;
    }
    return true;
  },

  async signMessage(message: string, publicKey: PublicKey | null, signMessage: any): Promise<string | null> {
    if (!publicKey || !signMessage) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Please connect your wallet first",
      });
      return null;
    }

    try {
      const encodedMessage = new TextEncoder().encode(message);
      const signedMessage = await signMessage(encodedMessage);
      return Buffer.from(signedMessage).toString('base64');
    } catch (error) {
      console.error('Error signing message:', error);
      toast({
        variant: "destructive",
        title: "Error signing message",
        description: "Please try again",
      });
      return null;
    }
  }
};

export default solanaService;
