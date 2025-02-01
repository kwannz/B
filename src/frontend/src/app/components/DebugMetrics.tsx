'use client';

import { Box, Card, CardContent, Typography, LinearProgress, Tooltip, IconButton } from '@mui/material';
import { Refresh, Download } from '@mui/icons-material';
import { useDebug } from '../contexts/DebugContext';
import { useState, useEffect } from 'react';

interface MetricData {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  description?: string;
}

interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  api_latency: number;
  active_trades: number;
  pending_orders: number;
  wallet_balance: number;
  trade_success_rate: number;
  profit_loss_ratio: number;
}

export default function DebugMetrics() {
  const { isDebugMode, log } = useDebug();
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu_usage: 0,
    memory_usage: 0,
    api_latency: 0,
    active_trades: 0,
    pending_orders: 0,
    wallet_balance: 0,
    trade_success_rate: 0,
    profit_loss_ratio: 0
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDebugMode) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 5000); // 每5秒更新一次
      return () => clearInterval(interval);
    }
  }, [isDebugMode]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      // 这里应该调用实际的API
      const response = await fetch('/api/debug/metrics');
      const data = await response.json();
      setMetrics(data);
      log('debug', 'Performance', '指标更新成功', data);
    } catch (error) {
      log('error', 'Performance', '获取指标失败', error);
    } finally {
      setLoading(false);
    }
  };

  const exportMetrics = () => {
    const content = JSON.stringify(metrics, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'debug_metrics.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const metricsList: MetricData[] = [
    {
      name: 'CPU使用率',
      value: metrics.cpu_usage,
      unit: '%',
      threshold: 80,
      description: 'CPU使用率超过80%可能影响交易性能'
    },
    {
      name: '内存使用率',
      value: metrics.memory_usage,
      unit: '%',
      threshold: 90,
      description: '内存使用率超过90%可能导致系统不稳定'
    },
    {
      name: 'API延迟',
      value: metrics.api_latency,
      unit: 'ms',
      threshold: 1000,
      description: 'API延迟超过1000ms可能影响交易时效'
    },
    {
      name: '活跃交易',
      value: metrics.active_trades,
      unit: '笔'
    },
    {
      name: '待处理订单',
      value: metrics.pending_orders,
      unit: '笔'
    },
    {
      name: '钱包余额',
      value: metrics.wallet_balance,
      unit: 'USDT'
    },
    {
      name: '交易成功率',
      value: metrics.trade_success_rate * 100,
      unit: '%',
      threshold: 50,
      description: '交易成功率低于50%需要检查策略'
    },
    {
      name: '盈亏比',
      value: metrics.profit_loss_ratio,
      unit: '',
      threshold: 1,
      description: '盈亏比低于1表示整体亏损'
    }
  ];

  if (!isDebugMode) return null;

  return (
    <Card>
      <CardContent>
        <Box className="flex justify-between items-center mb-4">
          <Typography variant="h6">系统指标监控</Typography>
          <Box>
            <IconButton onClick={fetchMetrics} disabled={loading}>
              <Refresh />
            </IconButton>
            <IconButton onClick={exportMetrics}>
              <Download />
            </IconButton>
          </Box>
        </Box>

        <Box className="space-y-4">
          {metricsList.map((metric) => (
            <Box key={metric.name} className="space-y-1">
              <Box className="flex justify-between">
                <Tooltip title={metric.description || ''}>
                  <Typography variant="body2" color="text.secondary">
                    {metric.name}
                  </Typography>
                </Tooltip>
                <Typography variant="body2">
                  {metric.value.toFixed(2)} {metric.unit}
                </Typography>
              </Box>
              {metric.threshold && (
                <LinearProgress
                  variant="determinate"
                  value={(metric.value / metric.threshold) * 100}
                  color={metric.value > metric.threshold ? "error" : "success"}
                />
              )}
            </Box>
          ))}
        </Box>

        {loading && (
          <Box className="mt-4">
            <LinearProgress />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
