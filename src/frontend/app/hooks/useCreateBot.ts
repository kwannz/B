import { useState } from 'react';
import { createBot, ApiError, Bot } from '../api/client';

export const useCreateBot = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [bot, setBot] = useState<Bot | null>(null);

  const create = async (type: string, strategy: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await createBot(type, strategy);
      setBot(data);
      return data;
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    create,
    isLoading,
    error,
    bot
  };
};
