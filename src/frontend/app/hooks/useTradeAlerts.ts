import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useTradeMonitor } from './useTradeMonitor';
import { useMarketDataProvider } from './useMarketDataProvider';

interface AlertConfig {
  price_change: number;
  volume_spike: number;
  profit_target: number;
  stop_loss: number;
  risk_threshold: number;
}

interface Alert {
  id: string;
  type: 'price' | 'volume' | 'profit' | 'risk' | 'system';
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  metadata?: {
    price?: number;
    volume?: number;
    profit?: number;
    risk_level?: string;
  };
}

export const useTradeAlerts = (botId: string | null, config: Partial<AlertConfig> = {}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { monitorData } = useTradeMonitor(botId);
  const { marketContext } = useMarketDataProvider(null, botId);

  const defaultConfig: AlertConfig = {
    price_change: 0.05,
    volume_spike: 2.0,
    profit_target: 0.1,
    stop_loss: 0.05,
    risk_threshold: 0.15,
    ...config
  };

  useEffect(() => {
    if (!monitorData || !marketContext) return;

    const checkPriceAlert = () => {
      const priceChange = Math.abs(marketContext.price.change_24h);
      if (priceChange >= defaultConfig.price_change) {
        const direction = marketContext.price.change_24h > 0 ? 'increase' : 'decrease';
        return {
          type: 'price' as const,
          severity: 'warning',
          message: `Price ${direction} of ${(priceChange * 100).toFixed(2)}% detected`,
          metadata: { price: marketContext.price.current }
        };
      }
      return null;
    };

    const checkVolumeAlert = () => {
      const volumeChange = marketContext.volume.current_24h / marketContext.volume.change_24h;
      if (volumeChange >= defaultConfig.volume_spike) {
        return {
          type: 'volume' as const,
          severity: 'info',
          message: `Volume spike detected: ${volumeChange.toFixed(2)}x average`,
          metadata: { volume: marketContext.volume.current_24h }
        };
      }
      return null;
    };

    const checkProfitAlert = () => {
      const currentProfit = monitorData.performance.current_pnl;
      if (Math.abs(currentProfit) >= defaultConfig.profit_target) {
        const type = currentProfit > 0 ? 'profit' : 'stop_loss';
        return {
          type: 'profit' as const,
          severity: currentProfit > 0 ? 'info' : 'warning',
          message: `${type === 'profit' ? 'Profit' : 'Loss'} target reached: ${currentProfit.toFixed(2)}`,
          metadata: { profit: currentProfit }
        };
      }
      return null;
    };

    const checkRiskAlert = () => {
      if (monitorData.risk.risk_level === 'high') {
        return {
          type: 'risk' as const,
          severity: 'error',
          message: `High risk level detected: ${(monitorData.risk.volatility * 100).toFixed(2)}% volatility`,
          metadata: { risk_level: monitorData.risk.risk_level }
        };
      }
      return null;
    };

    const newAlerts = [
      checkPriceAlert(),
      checkVolumeAlert(),
      checkProfitAlert(),
      checkRiskAlert()
    ].filter(Boolean) as Alert[];

    if (newAlerts.length > 0) {
      setAlerts(prev => [
        ...newAlerts.map(alert => ({
          ...alert,
          id: `${alert.type}-${Date.now()}`,
          timestamp: new Date().toISOString()
        })),
        ...prev
      ]);
    }

  }, [monitorData, marketContext, defaultConfig]);

  const clearAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  return {
    alerts,
    error,
    isMonitoring,
    clearAlert,
    clearAllAlerts
  };
};
