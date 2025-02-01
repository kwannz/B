import { useState } from 'react';
import { updateBotStatus, ApiError, Bot } from '../api/client';

export const useUpdateBotStatus = (botId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [status, setStatus] = useState<Bot | null>(null);

  const update = async (newStatus: 'active' | 'inactive') => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await updateBotStatus(botId, newStatus);
      setStatus(data);
      return data;
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    update,
    isLoading,
    error,
    status
  };
};
