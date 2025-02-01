import { useState, useEffect } from 'react';
import { compareWallets, ApiError, WalletComparison } from '../api/client';

export const useWalletComparison = (walletA: string | null, walletB: string | null) => {
  const [comparison, setComparison] = useState<WalletComparison | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!walletA || !walletB) return;

    const fetchComparison = async () => {
      try {
        setIsLoading(true);
        const data = await compareWallets(walletA, walletB);
        setComparison(data);
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setComparison(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
  }, [walletA, walletB]);

  return { comparison, error, isLoading };
};
