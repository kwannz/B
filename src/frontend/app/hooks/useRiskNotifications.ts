import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRiskMonitoring } from './useRiskMonitoring';
import { useRiskAnalyzer } from './useRiskAnalyzer';
import { useRiskController } from './useRiskController';

interface RiskNotification {
  id: string;
  type: 'risk' | 'market' | 'system' | 'execution';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metrics: {
    current_value: number;
    threshold_value: number;
    change_rate?: number;
  };
  actions: {
    type: 'view' | 'acknowledge' | 'action';
    label: string;
    handler: () => Promise<void>;
  }[];
  timestamp: string;
  acknowledged: boolean;
}

interface NotificationState {
  active: RiskNotification[];
  history: RiskNotification[];
  unread_count: number;
  last_update: string;
}

export const useRiskNotifications = (botId: string | null) => {
  const [state, setState] = useState<NotificationState>({
    active: [],
    history: [],
    unread_count: 0,
    last_update: new Date().toISOString()
  });
  const [error, setError] = useState<ApiError | null>(null);

  const { state: monitoringState } = useRiskMonitoring(botId);
  const { analysis, score } = useRiskAnalyzer(botId);
  const { state: controlState } = useRiskController(botId);

  useEffect(() => {
    if (!monitoringState || !analysis || !score) return;

    try {
      const generateNotifications = (): RiskNotification[] => {
        const notifications: RiskNotification[] = [];
        const timestamp = new Date().toISOString();

        if (score.risk_level === 'extreme') {
          notifications.push({
            id: `risk-${timestamp}`,
            type: 'risk',
            severity: 'critical',
            title: 'Critical Risk Level Detected',
            message: 'Portfolio risk has reached extreme levels. Immediate action required.',
            metrics: {
              current_value: score.total_score,
              threshold_value: 0.75,
              change_rate: (score.total_score - 0.75) / 0.75
            },
            actions: [{
              type: 'action',
              label: 'Review Risk Controls',
              handler: async () => {
                await controlState.executeControlAction({
                  type: 'reduce_exposure',
                  priority: 'immediate',
                  target: { exposure: 0.5 },
                  reason: 'Critical risk level mitigation'
                });
              }
            }],
            timestamp,
            acknowledged: false
          });
        }

        if (analysis.market_risk.volatility_impact > 0.8) {
          notifications.push({
            id: `market-${timestamp}`,
            type: 'market',
            severity: 'warning',
            title: 'High Market Volatility',
            message: 'Market volatility has exceeded normal thresholds.',
            metrics: {
              current_value: analysis.market_risk.volatility_impact,
              threshold_value: 0.8,
              change_rate: (analysis.market_risk.volatility_impact - 0.8) / 0.8
            },
            actions: [{
              type: 'view',
              label: 'View Market Analysis',
              handler: async () => {
                console.log('Navigate to market analysis view');
              }
            }],
            timestamp,
            acknowledged: false
          });
        }

        if (analysis.execution_risk.slippage_risk > 0.1) {
          notifications.push({
            id: `execution-${timestamp}`,
            type: 'execution',
            severity: 'warning',
            title: 'High Slippage Risk',
            message: 'Trade execution costs are above normal levels.',
            metrics: {
              current_value: analysis.execution_risk.slippage_risk,
              threshold_value: 0.1
            },
            actions: [{
              type: 'acknowledge',
              label: 'Acknowledge',
              handler: async () => {
                await acknowledgeNotification(`execution-${timestamp}`);
              }
            }],
            timestamp,
            acknowledged: false
          });
        }

        return notifications;
      };

      const newNotifications = generateNotifications();
      if (newNotifications.length > 0) {
        setState(prev => ({
          active: [...newNotifications, ...prev.active],
          history: [...prev.history, ...prev.active.filter(n => 
            newNotifications.some(nn => nn.type === n.type))],
          unread_count: prev.unread_count + newNotifications.length,
          last_update: new Date().toISOString()
        }));
      }

      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to process risk notifications',
        code: 'NOTIFICATION_ERROR'
      });
    }
  }, [monitoringState, analysis, score, controlState]);

  const acknowledgeNotification = async (notificationId: string) => {
    try {
      setState(prev => ({
        ...prev,
        active: prev.active.map(n => 
          n.id === notificationId ? { ...n, acknowledged: true } : n
        ),
        unread_count: Math.max(0, prev.unread_count - 1)
      }));
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to acknowledge notification',
        code: 'ACKNOWLEDGE_ERROR'
      });
    }
  };

  const clearNotification = (notificationId: string) => {
    setState(prev => ({
      ...prev,
      active: prev.active.filter(n => n.id !== notificationId),
      history: [...prev.history, ...prev.active.filter(n => n.id === notificationId)],
      unread_count: prev.unread_count - (prev.active.find(n => 
        n.id === notificationId && !n.acknowledged) ? 1 : 0)
    }));
  };

  const clearAllNotifications = () => {
    setState(prev => ({
      active: [],
      history: [...prev.history, ...prev.active],
      unread_count: 0,
      last_update: new Date().toISOString()
    }));
  };

  return {
    state,
    error,
    acknowledgeNotification,
    clearNotification,
    clearAllNotifications
  };
};
