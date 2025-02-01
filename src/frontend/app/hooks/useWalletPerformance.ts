import { useState, useEffect } from 'react';
import { getWallet, ApiError, Wallet } from '../api/client';

export const useWalletPerformance = (walletAddress: string | null) => {
  const [performance, setPerformance] = useState<Wallet['performance'] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;

    const fetchPerformance = async () => {
      try {
        setIsLoading(true);
        const data = await getWallet(walletAddress);
        setPerformance(data.performance || null);
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setPerformance(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformance();
    const interval = setInterval(fetchPerformance, 30000); // Update every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, [walletAddress]);

  return { performance, error, isLoading };
};
