import { useState, useEffect } from 'react';
import { getBotStatus, ApiError, Bot } from '../api/client';

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  botId: string;
  isRead: boolean;
}

export const useBotAlerts = (botId: string | null) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchAlerts = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        if (data.alerts) {
          setAlerts(data.alerts);
        }
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setAlerts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Update every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, [botId]);

  const markAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, isRead: true } : alert
    ));
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  return { alerts, error, isLoading, markAsRead, clearAlerts };
};
