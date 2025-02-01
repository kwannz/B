import { useState, useEffect } from 'react';
import { getBotStatus, updateBotStatus, ApiError, Bot } from '../api/client';

interface BotConfig {
  risk_level: 'low' | 'medium' | 'high';
  max_trade_size: number;
  stop_loss_percentage: number;
  take_profit_percentage: number;
  trading_pair: string;
  auto_rebalance: boolean;
  rebalance_threshold: number;
  trading_enabled: boolean;
}

export const useBotConfig = (botId: string | null) => {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        if (data.config) {
          setConfig(data.config);
        }
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setConfig(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [botId]);

  const updateConfig = async (newConfig: Partial<BotConfig>) => {
    if (!botId || !config) return;

    try {
      setIsSaving(true);
      const updatedConfig = { ...config, ...newConfig };
      await updateBotStatus(botId, 'active');
      setConfig(updatedConfig);
      setError(null);
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTradingStatus = async () => {
    if (!botId || !config) return;

    try {
      setIsSaving(true);
      const newStatus = !config.trading_enabled;
      await updateBotStatus(botId, newStatus ? 'active' : 'inactive');
      setConfig({ ...config, trading_enabled: newStatus });
      setError(null);
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    config,
    error,
    isLoading,
    isSaving,
    updateConfig,
    toggleTradingStatus
  };
};
