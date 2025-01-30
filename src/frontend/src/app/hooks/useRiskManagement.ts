import { useState, useEffect } from 'react';
import { getBotStatus, updateBotStatus, ApiError, Bot } from '../api/client';

interface RiskSettings {
  max_position_size: number;
  stop_loss_percentage: number;
  take_profit_percentage: number;
  max_drawdown: number;
  daily_loss_limit: number;
  leverage_limit: number;
  position_limits: {
    asset: string;
    max_amount: number;
  }[];
}

export const useRiskManagement = (botId: string | null) => {
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!botId) return;

    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const data = await getBotStatus(botId);
        if (data.risk_settings) {
          setSettings(data.risk_settings);
        }
        setError(null);
      } catch (err) {
        setError(err as ApiError);
        setSettings(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [botId]);

  const updateSettings = async (newSettings: Partial<RiskSettings>) => {
    if (!botId || !settings) return;

    try {
      setIsSaving(true);
      const updatedSettings = { ...settings, ...newSettings };
      await updateBotStatus(botId, 'active');
      setSettings(updatedSettings);
      setError(null);
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!botId) return;

    const defaultSettings: RiskSettings = {
      max_position_size: 1000,
      stop_loss_percentage: 2,
      take_profit_percentage: 4,
      max_drawdown: 10,
      daily_loss_limit: 5,
      leverage_limit: 3,
      position_limits: []
    };

    try {
      setIsSaving(true);
      await updateBotStatus(botId, 'active');
      setSettings(defaultSettings);
      setError(null);
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    settings,
    error,
    isLoading,
    isSaving,
    updateSettings,
    resetToDefaults
  };
};
