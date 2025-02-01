import { useState, useEffect } from 'react';
import { listWallets, ApiError, Bot } from '../api/client';

export const useBotList = () => {
  const [bots, setBots] = useState<Bot[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBots = async () => {
      try {
        setIsLoading(true);
        const data = await listWallets();
        setBots(data);
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setBots([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBots();
  }, []);

  return { bots, error, isLoading };
};
