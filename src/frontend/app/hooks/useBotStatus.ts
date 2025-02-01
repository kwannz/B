import { useState, useEffect } from 'react';
import { pollBotStatus, ApiError } from '../api/client';

export const useBotStatus = (botId: string | null) => {
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    setIsLoading(true);
    const poller = pollBotStatus(botId);

    poller.start(
      (data) => {
        setStatus(data);
        setError(null);
        setIsLoading(false);
      },
      (error) => {
        setError(error);
        setIsLoading(false);
      }
    );

    return () => {
      poller.stop();
    };
  }, [botId]);

  return { status, error, isLoading };
};
