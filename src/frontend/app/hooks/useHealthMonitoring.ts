import { useState, useEffect } from 'react';
import { ApiError } from '../api/client';
import { useSystemMonitoring } from './useSystemMonitoring';
import { useMarketDataMonitoring } from './useMarketDataMonitoring';
import { useRiskMonitoring } from './useRiskMonitoring';

interface HealthMetrics {
  system: {
    status: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    last_incident: string | null;
    active_incidents: number;
  };
  performance: {
    api_response_time: number;
    websocket_latency: number;
    order_execution_time: number;
    data_processing_time: number;
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
    monitoring: boolean;
  };
}

interface HealthAlert {
  id: string;
  type: 'system' | 'performance' | 'resource' | 'service';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  resolution_time?: string;
}

interface MonitoringConfig {
  check_interval: number;
  alert_thresholds: {
    api_response_time: number;
    websocket_latency: number;
    execution_time: number;
    resource_usage: number;
  };
}

export const useHealthMonitoring = (config: MonitoringConfig) => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { metrics: systemMetrics } = useSystemMonitoring({
    alert_thresholds: {
      api_latency: config.alert_thresholds.api_response_time,
      execution_time: config.alert_thresholds.execution_time,
      error_rate: 0.1,
      resource_usage: config.alert_thresholds.resource_usage
    },
    update_interval: config.check_interval
  });

  const { health: marketHealth } = useMarketDataMonitoring({
    symbol: 'SOL/USD',
    alert_thresholds: {
      price_change: 0.05,
      volume_spike: 2,
      liquidity_drop: 0.3,
      volatility_surge: 2
    },
    update_interval: config.check_interval
  });

  const { state: riskState } = useRiskMonitoring(null);

  useEffect(() => {
    if (!systemMetrics || !marketHealth) return;

    const monitoringInterval = setInterval(() => {
      try {
        setIsMonitoring(true);

        const calculateMetrics = () => {
          const performance = {
            api_response_time: systemMetrics.performance.api_latency,
            websocket_latency: systemMetrics.performance.data_stream_delay,
            order_execution_time: systemMetrics.performance.order_execution_time,
            data_processing_time: Math.random() * 100
          };

          const resources = {
            cpu_usage: systemMetrics.resources.cpu_usage,
            memory_usage: systemMetrics.resources.memory_usage,
            disk_usage: systemMetrics.resources.disk_usage,
            network_bandwidth: systemMetrics.resources.network_bandwidth
          };

          const services = {
            api_gateway: systemMetrics.services.api_gateway,
            market_data: systemMetrics.services.market_data,
            order_execution: systemMetrics.services.order_execution,
            risk_management: riskState?.status !== 'error',
            monitoring: true
          };

          const status = 
            Object.values(services).some(s => !s) ? 'critical' :
            performance.api_response_time > config.alert_thresholds.api_response_time ||
            performance.websocket_latency > config.alert_thresholds.websocket_latency ||
            Object.values(resources).some(r => r > config.alert_thresholds.resource_usage)
              ? 'degraded' : 'healthy';

          return {
            system: {
              status,
              uptime: performance.api_response_time < 1000 ? 100 : 99.9,
              last_incident: status === 'critical' ? new Date().toISOString() : null,
              active_incidents: status === 'critical' ? 1 : 0
            },
            performance,
            resources,
            services
          };
        };

        const generateAlerts = (healthMetrics: HealthMetrics) => {
          const newAlerts: HealthAlert[] = [];
          const timestamp = new Date().toISOString();

          if (healthMetrics.performance.api_response_time > 
              config.alert_thresholds.api_response_time) {
            newAlerts.push({
              id: `perf-${Date.now()}`,
              type: 'performance',
              severity: 'warning',
              message: `High API response time: ${
                healthMetrics.performance.api_response_time.toFixed(2)
              }ms`,
              timestamp,
              resolved: false
            });
          }

          if (healthMetrics.performance.websocket_latency > 
              config.alert_thresholds.websocket_latency) {
            newAlerts.push({
              id: `ws-${Date.now()}`,
              type: 'performance',
              severity: 'warning',
              message: `High WebSocket latency: ${
                healthMetrics.performance.websocket_latency.toFixed(2)
              }ms`,
              timestamp,
              resolved: false
            });
          }

          Object.entries(healthMetrics.resources).forEach(([resource, usage]) => {
            if (usage > config.alert_thresholds.resource_usage) {
              newAlerts.push({
                id: `resource-${Date.now()}-${resource}`,
                type: 'resource',
                severity: usage > config.alert_thresholds.resource_usage * 1.5 ? 
                  'critical' : 'warning',
                message: `High ${resource} usage: ${usage.toFixed(2)}%`,
                timestamp,
                resolved: false
              });
            }
          });

          Object.entries(healthMetrics.services).forEach(([service, status]) => {
            if (!status) {
              newAlerts.push({
                id: `service-${Date.now()}-${service}`,
                type: 'service',
                severity: 'critical',
                message: `Service ${service} is down`,
                timestamp,
                resolved: false
              });
            }
          });

          setAlerts(prev => {
            const resolvedAlerts = prev.map(alert => {
              if (alert.resolved) return alert;
              
              const isResolved = 
                alert.type === 'performance' && 
                  healthMetrics.performance.api_response_time <= 
                    config.alert_thresholds.api_response_time ||
                alert.type === 'resource' && 
                  !Object.values(healthMetrics.resources)
                    .some(r => r > config.alert_thresholds.resource_usage) ||
                alert.type === 'service' && 
                  Object.values(healthMetrics.services).every(s => s);

              return isResolved ? {
                ...alert,
                resolved: true,
                resolution_time: new Date().toISOString()
              } : alert;
            });

            return [...newAlerts, ...resolvedAlerts].slice(0, 100);
          });
        };

        const newMetrics = calculateMetrics();
        setMetrics(newMetrics);
        generateAlerts(newMetrics);
        setError(null);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Failed to monitor system health',
          code: 'MONITORING_ERROR'
        });
      } finally {
        setIsMonitoring(false);
      }
    }, config.check_interval);

    return () => clearInterval(monitoringInterval);
  }, [systemMetrics, marketHealth, riskState, config]);

  const getSystemMetrics = () => metrics?.system || null;

  const getPerformanceMetrics = () => metrics?.performance || null;

  const getResourceMetrics = () => metrics?.resources || null;

  const getServiceStatus = () => metrics?.services || null;

  const getActiveAlerts = () => 
    alerts.filter(a => !a.resolved);

  const getResolvedAlerts = () => 
    alerts.filter(a => a.resolved);

  const getAlertsByType = (type: HealthAlert['type']) =>
    alerts.filter(a => a.type === type);

  const getAlertsBySeverity = (severity: HealthAlert['severity']) =>
    alerts.filter(a => a.severity === severity);

  const getHealthSummary = () => {
    if (!metrics) return null;

    return {
      overall_status: metrics.system.status,
      active_incidents: metrics.system.active_incidents,
      service_availability: Object.values(metrics.services)
        .filter(status => status).length / 
        Object.values(metrics.services).length * 100,
      performance_score: 100 - (
        metrics.performance.api_response_time / config.alert_thresholds.api_response_time +
        metrics.performance.websocket_latency / config.alert_thresholds.websocket_latency
      ) * 50,
      resource_utilization: Object.values(metrics.resources)
        .reduce((sum, usage) => sum + usage, 0) / 
        Object.values(metrics.resources).length
    };
  };

  return {
    metrics,
    alerts,
    error,
    isMonitoring,
    getSystemMetrics,
    getPerformanceMetrics,
    getResourceMetrics,
    getServiceStatus,
    getActiveAlerts,
    getResolvedAlerts,
    getAlertsByType,
    getAlertsBySeverity,
    getHealthSummary
  };
};
