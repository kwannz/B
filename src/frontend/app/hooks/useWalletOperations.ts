import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useWallet } from './useWallet';
import { useRiskController } from './useRiskController';

interface WalletTransaction {
  id: string;
  type: 'transfer' | 'trade' | 'fee';
  amount: number;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  hash: string;
  from: string;
  to: string;
  fee: number;
}

interface WalletBalance {
  total: number;
  available: number;
  locked: number;
  pending: number;
}

interface WalletOperations {
  transfer: (to: string, amount: number) => Promise<WalletTransaction>;
  getBalance: () => Promise<WalletBalance>;
  getTransactions: (limit?: number) => Promise<WalletTransaction[]>;
  validateAddress: (address: string) => boolean;
  estimateFee: (to: string, amount: number) => Promise<number>;
}

export const useWalletOperations = (botId: string | null) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { wallet } = useWallet(botId);
  const { state: riskState } = useRiskController(botId);

  useEffect(() => {
    if (!wallet) return;

    const updateInterval = setInterval(async () => {
      try {
        const mockBalance: WalletBalance = {
          total: wallet.balance || 0,
          available: (wallet.balance || 0) * 0.9,
          locked: (wallet.balance || 0) * 0.1,
          pending: 0
        };

        setBalance(mockBalance);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to update wallet balance',
          code: 'BALANCE_ERROR'
        });
      }
    }, 10000);

    return () => clearInterval(updateInterval);
  }, [wallet]);

  const transfer = async (to: string, amount: number): Promise<WalletTransaction> => {
    try {
      setIsProcessing(true);

      if (!wallet) {
        throw new Error('Wallet not initialized');
      }

      if (!validateAddress(to)) {
        throw new Error('Invalid destination address');
      }

      if (amount <= 0) {
        throw new Error('Invalid transfer amount');
      }

      if (amount > (balance?.available || 0)) {
        throw new Error('Insufficient available balance');
      }

      const fee = await estimateFee(to, amount);
      if (amount + fee > (balance?.available || 0)) {
        throw new Error('Insufficient balance to cover transfer and fee');
      }

      const transaction: WalletTransaction = {
        id: `tx-${Date.now()}`,
        type: 'transfer',
        amount,
        timestamp: new Date().toISOString(),
        status: 'pending',
        hash: `hash-${Date.now()}`,
        from: wallet.address || '',
        to,
        fee
      };

      setTransactions(prev => [transaction, ...prev]);
      setError(null);
      return transaction;
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to transfer funds',
        code: 'TRANSFER_ERROR'
      });
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const getBalance = async (): Promise<WalletBalance> => {
    try {
      if (!wallet) {
        throw new Error('Wallet not initialized');
      }

      return balance || {
        total: 0,
        available: 0,
        locked: 0,
        pending: 0
      };
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to get balance',
        code: 'BALANCE_ERROR'
      });
      throw err;
    }
  };

  const getTransactions = async (limit: number = 50): Promise<WalletTransaction[]> => {
    try {
      if (!wallet) {
        throw new Error('Wallet not initialized');
      }

      return transactions.slice(0, limit);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to get transactions',
        code: 'TRANSACTION_ERROR'
      });
      throw err;
    }
  };

  const validateAddress = (address: string): boolean => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  const estimateFee = async (to: string, amount: number): Promise<number> => {
    try {
      if (!wallet) {
        throw new Error('Wallet not initialized');
      }

      const baseFee = 0.000005;
      const complexityFactor = amount > 1 ? 1.5 : 1;
      return baseFee * complexityFactor;
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to estimate fee',
        code: 'FEE_ERROR'
      });
      throw err;
    }
  };

  const getPendingTransactions = () => {
    return transactions.filter(tx => tx.status === 'pending');
  };

  const getTransactionsByType = (type: WalletTransaction['type']) => {
    return transactions.filter(tx => tx.type === type);
  };

  const getTransactionById = (id: string) => {
    return transactions.find(tx => tx.id === id);
  };

  return {
    transactions,
    balance,
    error,
    isProcessing,
    transfer,
    getBalance,
    getTransactions,
    validateAddress,
    estimateFee,
    getPendingTransactions,
    getTransactionsByType,
    getTransactionById
  };
};
