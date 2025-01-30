import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useTradeExecution } from './useTradeExecution';
import { useOrderManagement } from './useOrderManagement';
import { useRiskController } from './useRiskController';

interface TradeAlert {
  id: string;
  type: 'execution' | 'risk' | 'performance';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: string;
}

interface TradeStatus {
  active_orders: number;
  pending_orders: number;
  filled_orders: number;
  failed_orders: number;
  average_execution_time: number;
  success_rate: number;
}

interface ExecutionMetrics {
  slippage: number;
  impact: number;
  fill_rate: number;
  execution_speed: number;
  rejection_rate: number;
}

export const useTradeMonitoring = (botId: string | null) => {
  const [alerts, setAlerts] = useState<TradeAlert[]>([]);
  const [status, setStatus] = useState<TradeStatus | null>(null);
  const [metrics, setMetrics] = useState<ExecutionMetrics | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { orders, metrics: executionMetrics } = useOrderManagement(botId);
  const { state: executionState } = useTradeExecution(botId);
  const { state: riskState } = useRiskController(botId);

  useEffect(() => {
    if (!botId || !executionMetrics) return;

    const monitoringInterval = setInterval(() => {
      try {
        setIsMonitoring(true);

        const updateStatus = () => {
          const activeOrders = orders.filter(o => 
            ['new', 'partially_filled'].includes(o.status)
          );
          const filledOrders = orders.filter(o => o.status === 'filled');
          const failedOrders = orders.filter(o => 
            ['rejected', 'canceled'].includes(o.status)
          );

          const avgExecutionTime = filledOrders.reduce((sum, order) => {
            const executionTime = new Date(order.lastUpdate).getTime() - 
                                new Date(order.timestamp).getTime();
            return sum + executionTime;
          }, 0) / Math.max(1, filledOrders.length);

          setStatus({
            active_orders: activeOrders.length,
            pending_orders: orders.filter(o => o.status === 'new').length,
            filled_orders: filledOrders.length,
            failed_orders: failedOrders.length,
            average_execution_time: avgExecutionTime,
            success_rate: filledOrders.length / Math.max(1, orders.length)
          });
        };

        const updateMetrics = () => {
          const filledOrders = orders.filter(o => 
            o.status === 'filled' || o.status === 'partially_filled'
          );

          const avgSlippage = filledOrders.reduce((sum, order) => {
            const expectedPrice = order.price || 0;
            return sum + Math.abs(order.averagePrice - expectedPrice) / expectedPrice;
          }, 0) / Math.max(1, filledOrders.length);

          setMetrics({
            slippage: avgSlippage,
            impact: executionMetrics.impact,
            fill_rate: filledOrders.reduce((sum, o) => 
              sum + o.filledQuantity / o.quantity, 0
            ) / Math.max(1, filledOrders.length),
            execution_speed: executionMetrics.speed,
            rejection_rate: orders.filter(o => o.status === 'rejected').length / 
                          Math.max(1, orders.length)
          });
        };

        const generateAlerts = () => {
          const newAlerts: TradeAlert[] = [];
          const timestamp = new Date().toISOString();

          if (metrics?.slippage > 0.01) {
            newAlerts.push({
              id: `slippage-${Date.now()}`,
              type: 'execution',
              severity: 'warning',
              message: 'High slippage detected in recent trades',
              details: { slippage: metrics.slippage },
              timestamp
            });
          }

          if (metrics?.rejection_rate > 0.2) {
            newAlerts.push({
              id: `rejection-${Date.now()}`,
              type: 'execution',
              severity: 'critical',
              message: 'High order rejection rate',
              details: { rejection_rate: metrics.rejection_rate },
              timestamp
            });
          }

          if (status?.success_rate < 0.8) {
            newAlerts.push({
              id: `success-${Date.now()}`,
              type: 'performance',
              severity: 'warning',
              message: 'Low trade execution success rate',
              details: { success_rate: status.success_rate },
              timestamp
            });
          }

          if (riskState?.status === 'warning') {
            newAlerts.push({
              id: `risk-${Date.now()}`,
              type: 'risk',
              severity: 'critical',
              message: 'Risk limits approaching threshold',
              details: { risk_status: riskState.status },
              timestamp
            });
          }

          setAlerts(prev => [...newAlerts, ...prev].slice(0, 100));
        };

        updateStatus();
        updateMetrics();
        generateAlerts();
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to monitor trades',
          code: 'MONITOR_ERROR'
        });
      } finally {
        setIsMonitoring(false);
      }
    }, 5000);

    return () => clearInterval(monitoringInterval);
  }, [botId, orders, executionMetrics, executionState, riskState]);

  const getAlertsByType = (type: TradeAlert['type']) => {
    return alerts.filter(alert => alert.type === type);
  };

  const getAlertsBySeverity = (severity: TradeAlert['severity']) => {
    return alerts.filter(alert => alert.severity === severity);
  };

  const clearAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const getExecutionSummary = () => {
    if (!status) return null;
    return {
      total_orders: orders.length,
      success_rate: status.success_rate,
      average_execution_time: status.average_execution_time,
      active_orders: status.active_orders
    };
  };

  return {
    alerts,
    status,
    metrics,
    error,
    isMonitoring,
    getAlertsByType,
    getAlertsBySeverity,
    clearAlert,
    getExecutionSummary
  };
};
