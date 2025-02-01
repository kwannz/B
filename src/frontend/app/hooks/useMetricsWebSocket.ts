import { useState, useEffect, useCallback } from 'react';
import { ApiError } from '../api/client';
import { useMetricsStore } from './useMetricsStore';

interface WebSocketConfig {
  url: string;
  channels: {
    system: boolean;
    market: boolean;
    trading: boolean;
  };
  reconnect_interval: number;
  max_reconnect_attempts: number;
}

interface WebSocketMessage {
  type: 'system' | 'market' | 'trading';
  data: Record<string, any>;
  timestamp: string;
}

export const useMetricsWebSocket = (config: WebSocketConfig) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const store = useMetricsStore();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(config.url);

      ws.onopen = () => {
        setIsConnected(true);
        setReconnectAttempts(0);
        setError(null);

        const subscribeMessage = {
          type: 'subscribe',
          channels: Object.entries(config.channels)
            .filter(([_, enabled]) => enabled)
            .map(([channel]) => channel)
        };
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'system':
              store.updateMetrics({
                system: {
                  health: message.data.health,
                  performance: {
                    api_latency: [message.data.performance.api_latency],
                    execution_time: [message.data.performance.execution_time],
                    error_rate: [message.data.performance.error_rate],
                    uptime: message.data.performance.uptime
                  },
                  resources: {
                    cpu_usage: [message.data.resources.cpu_usage],
                    memory_usage: [message.data.resources.memory_usage],
                    disk_usage: [message.data.resources.disk_usage],
                    network_bandwidth: [message.data.resources.network_bandwidth]
                  }
                }
              });
              break;

            case 'market':
              store.updateMetrics({
                market: {
                  status: message.data.status,
                  data: {
                    price_updates: message.data.price_updates,
                    trade_volume: message.data.trade_volume,
                    liquidity_score: message.data.liquidity_score,
                    volatility: message.data.volatility
                  },
                  signals: {
                    buy_pressure: message.data.signals.buy_pressure,
                    sell_pressure: message.data.signals.sell_pressure,
                    momentum: message.data.signals.momentum,
                    trend: message.data.signals.trend
                  }
                }
              });
              break;

            case 'trading':
              store.updateMetrics({
                trading: {
                  performance: {
                    success_rate: message.data.performance.success_rate,
                    profit_loss: message.data.performance.profit_loss,
                    average_return: message.data.performance.average_return,
                    sharpe_ratio: message.data.performance.sharpe_ratio
                  },
                  risk: {
                    exposure: message.data.risk.exposure,
                    drawdown: message.data.risk.drawdown,
                    var_95: message.data.risk.var_95,
                    beta: message.data.risk.beta
                  },
                  operations: {
                    active_orders: message.data.operations.active_orders,
                    filled_orders: message.data.operations.filled_orders,
                    canceled_orders: message.data.operations.canceled_orders,
                    error_rate: message.data.operations.error_rate
                  }
                }
              });
              break;
          }

          if (message.data.alerts?.length > 0) {
            message.data.alerts.forEach((alert: any) => {
              store.addAlert({
                id: alert.id,
                type: message.type,
                severity: alert.severity,
                message: alert.message,
                timestamp: message.timestamp,
                metrics: alert.metrics
              });
            });
          }
        } catch (err) {
          setError({
            message: err instanceof Error ? err.message : 'Failed to process WebSocket message',
            code: 'WS_MESSAGE_ERROR'
          });
        }
      };

      ws.onerror = (event) => {
        setError({
          message: 'WebSocket connection error',
          code: 'WS_CONNECTION_ERROR'
        });
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (reconnectAttempts < config.max_reconnect_attempts) {
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, config.reconnect_interval);
        } else {
          setError({
            message: 'Maximum WebSocket reconnection attempts reached',
            code: 'WS_MAX_RECONNECT_ERROR'
          });
        }
      };

      setSocket(ws);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to establish WebSocket connection',
        code: 'WS_SETUP_ERROR'
      });
    }
  }, [config, reconnectAttempts, store]);

  useEffect(() => {
    connect();
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [connect, socket]);

  const sendMessage = (message: Record<string, any>) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(message));
    } else {
      setError({
        message: 'Cannot send message: WebSocket not connected',
        code: 'WS_NOT_CONNECTED'
      });
    }
  };

  const reconnect = () => {
    if (socket) {
      socket.close();
    }
    setReconnectAttempts(0);
    connect();
  };

  const getConnectionStatus = () => ({
    connected: isConnected,
    reconnect_attempts: reconnectAttempts,
    max_attempts: config.max_reconnect_attempts,
    channels: config.channels
  });

  return {
    isConnected,
    error,
    sendMessage,
    reconnect,
    getConnectionStatus
  };
};
