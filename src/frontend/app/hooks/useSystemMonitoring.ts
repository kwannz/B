import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useMarketDataMonitoring } from './useMarketDataMonitoring';
import { useOrderFlow } from './useOrderFlow';
import { useRiskMonitoring } from './useRiskMonitoring';

interface SystemMetrics {
  performance: {
    api_latency: number;
    order_execution_time: number;
    data_stream_delay: number;
    websocket_health: boolean;
  };
  resources: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    network_bandwidth: number;
  };
  services: {
    api_gateway: boolean;
    market_data: boolean;
    order_execution: boolean;
    risk_management: boolean;
  };
  errors: {
    api_errors: number;
    execution_errors: number;
    data_errors: number;
    total_errors: number;
  };
}

interface SystemAlert {
  id: string;
  type: 'performance' | 'resource' | 'service' | 'error';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  metadata: Record<string, any>;
}

interface MonitoringConfig {
  alert_thresholds: {
    api_latency: number;
    execution_time: number;
    error_rate: number;
    resource_usage: number;
  };
  update_interval: number;
}

export const useSystemMonitoring = (config: MonitoringConfig) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { health: marketHealth } = useMarketDataMonitoring({
    symbol: 'SOL/USD',
    alert_thresholds: {
      price_change: 0.05,
      volume_spike: 2,
      liquidity_drop: 0.3,
      volatility_surge: 2
    },
    update_interval: config.update_interval
  });

  const { metrics: flowMetrics } = useOrderFlow('SOL/USD');
  const { state: riskState } = useRiskMonitoring(null);

  useEffect(() => {
    if (!marketHealth || !flowMetrics) return;

    const monitoringInterval = setInterval(() => {
      try {
        setIsMonitoring(true);

        const generateMetrics = () => {
          const performance = {
            api_latency: Math.random() * 100,
            order_execution_time: Math.random() * 1000,
            data_stream_delay: Math.random() * 50,
            websocket_health: true
          };

          const resources = {
            cpu_usage: Math.random() * 100,
            memory_usage: Math.random() * 100,
            disk_usage: Math.random() * 100,
            network_bandwidth: Math.random() * 1000
          };

          const services = {
            api_gateway: true,
            market_data: marketHealth.status !== 'critical',
            order_execution: flowMetrics.trades.average_size > 0,
            risk_management: riskState?.status !== 'error'
          };

          const errors = {
            api_errors: Math.floor(Math.random() * 10),
            execution_errors: Math.floor(Math.random() * 5),
            data_errors: Math.floor(Math.random() * 3),
            total_errors: 0
          };
          errors.total_errors = 
            errors.api_errors + 
            errors.execution_errors + 
            errors.data_errors;

          return {
            performance,
            resources,
            services,
            errors
          };
        };

        const generateAlerts = (systemMetrics: SystemMetrics) => {
          const newAlerts: SystemAlert[] = [];
          const timestamp = new Date().toISOString();

          if (systemMetrics.performance.api_latency > config.alert_thresholds.api_latency) {
            newAlerts.push({
              id: `perf-${Date.now()}`,
              type: 'performance',
              severity: 'warning',
              message: `High API latency: ${systemMetrics.performance.api_latency.toFixed(2)}ms`,
              timestamp,
              metadata: {
                latency: systemMetrics.performance.api_latency,
                threshold: config.alert_thresholds.api_latency
              }
            });
          }

          if (systemMetrics.performance.order_execution_time > 
              config.alert_thresholds.execution_time) {
            newAlerts.push({
              id: `exec-${Date.now()}`,
              type: 'performance',
              severity: 'warning',
              message: `Slow order execution: ${
                systemMetrics.performance.order_execution_time.toFixed(2)
              }ms`,
              timestamp,
              metadata: {
                execution_time: systemMetrics.performance.order_execution_time,
                threshold: config.alert_thresholds.execution_time
              }
            });
          }

          const errorRate = systemMetrics.errors.total_errors / 
            config.update_interval * 1000;
          if (errorRate > config.alert_thresholds.error_rate) {
            newAlerts.push({
              id: `error-${Date.now()}`,
              type: 'error',
              severity: 'critical',
              message: `High error rate: ${errorRate.toFixed(2)} errors/sec`,
              timestamp,
              metadata: {
                error_rate: errorRate,
                threshold: config.alert_thresholds.error_rate,
                errors: systemMetrics.errors
              }
            });
          }

          Object.entries(systemMetrics.resources).forEach(([resource, usage]) => {
            if (usage > config.alert_thresholds.resource_usage) {
              newAlerts.push({
                id: `resource-${Date.now()}-${resource}`,
                type: 'resource',
                severity: usage > config.alert_thresholds.resource_usage * 1.5 ? 
                  'critical' : 'warning',
                message: `High ${resource} usage: ${usage.toFixed(2)}%`,
                timestamp,
                metadata: {
                  resource,
                  usage,
                  threshold: config.alert_thresholds.resource_usage
                }
              });
            }
          });

          Object.entries(systemMetrics.services).forEach(([service, status]) => {
            if (!status) {
              newAlerts.push({
                id: `service-${Date.now()}-${service}`,
                type: 'service',
                severity: 'critical',
                message: `Service ${service} is down`,
                timestamp,
                metadata: {
                  service,
                  status
                }
              });
            }
          });

          setAlerts(prev => [...newAlerts, ...prev].slice(0, 100));
        };

        const newMetrics = generateMetrics();
        setMetrics(newMetrics);
        generateAlerts(newMetrics);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to monitor system',
          code: 'MONITORING_ERROR'
        });
      } finally {
        setIsMonitoring(false);
      }
    }, config.update_interval);

    return () => clearInterval(monitoringInterval);
  }, [marketHealth, flowMetrics, riskState, config]);

  const getPerformanceMetrics = () => metrics?.performance || null;

  const getResourceMetrics = () => metrics?.resources || null;

  const getServiceStatus = () => metrics?.services || null;

  const getErrorMetrics = () => metrics?.errors || null;

  const getAlertsByType = (type: SystemAlert['type']) =>
    alerts.filter(a => a.type === type);

  const getAlertsBySeverity = (severity: SystemAlert['severity']) =>
    alerts.filter(a => a.severity === severity);

  const getRecentAlerts = (limit: number = 10) =>
    alerts.slice(0, limit);

  const getSystemHealth = () => {
    if (!metrics) return 'unknown';

    const criticalIssues = alerts.filter(a => a.severity === 'critical').length;
    const warningIssues = alerts.filter(a => a.severity === 'warning').length;

    return criticalIssues > 0 ? 'critical' :
           warningIssues > 2 ? 'warning' : 'healthy';
  };

  const getMonitoringSummary = () => {
    if (!metrics) return null;

    return {
      system_health: getSystemHealth(),
      active_alerts: alerts.length,
      critical_issues: alerts.filter(a => a.severity === 'critical').length,
      service_availability: Object.values(metrics.services)
        .filter(status => status).length / 
        Object.values(metrics.services).length * 100
    };
  };

  return {
    metrics,
    alerts,
    error,
    isMonitoring,
    getPerformanceMetrics,
    getResourceMetrics,
    getServiceStatus,
    getErrorMetrics,
    getAlertsByType,
    getAlertsBySeverity,
    getRecentAlerts,
    getSystemHealth,
    getMonitoringSummary
  };
};
