import { useState, useEffect } from 'react';
import { getWallet, ApiError, Wallet } from '../api/client';

export const useWallet = (botId: string | null) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchWallet = async () => {
      try {
        setIsLoading(true);
        const data = await getWallet(botId);
        setWallet(data);
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setWallet(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWallet();
  }, [botId]);

  return { wallet, error, isLoading };
};
