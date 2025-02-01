'use client';

import { Box, Card, CardContent, Typography, FormControl, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import { useDebug } from '../contexts/DebugContext';
import { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData
} from 'chart.js';

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MetricHistory {
  timestamp: number;
  value: number;
}

interface MetricOption {
  key: keyof SystemMetrics;
  label: string;
  unit: string;
  color: string;
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

const metricOptions: MetricOption[] = [
  { key: 'cpu_usage', label: 'CPU使用率', unit: '%', color: '#4CAF50' },
  { key: 'memory_usage', label: '内存使用率', unit: '%', color: '#2196F3' },
  { key: 'api_latency', label: 'API延迟', unit: 'ms', color: '#FF9800' },
  { key: 'active_trades', label: '活跃交易', unit: '笔', color: '#9C27B0' },
  { key: 'pending_orders', label: '待处理订单', unit: '笔', color: '#607D8B' },
  { key: 'wallet_balance', label: '钱包余额', unit: 'USDT', color: '#E91E63' },
  { key: 'trade_success_rate', label: '交易成功率', unit: '%', color: '#00BCD4' },
  { key: 'profit_loss_ratio', label: '盈亏比', unit: '', color: '#795548' }
];

const MAX_DATA_POINTS = 50; // 最多显示50个数据点

export default function DebugMetricsChart() {
  const { isDebugMode } = useDebug();
  const [selectedMetric, setSelectedMetric] = useState<keyof SystemMetrics>('cpu_usage');
  const [metricHistory, setMetricHistory] = useState<MetricHistory[]>([]);
  const chartRef = useRef<ChartJS>(null);

  useEffect(() => {
    if (isDebugMode) {
      const interval = setInterval(fetchMetricData, 5000);
      return () => clearInterval(interval);
    }
  }, [isDebugMode, selectedMetric]);

  const fetchMetricData = async () => {
    try {
      const response = await fetch('/api/debug/metrics');
      const data: SystemMetrics = await response.json();
      
      setMetricHistory(prev => {
        const newHistory = [
          ...prev,
          { timestamp: Date.now(), value: data[selectedMetric] }
        ];
        // 保持最新的50个数据点
        return newHistory.slice(-MAX_DATA_POINTS);
      });
    } catch (error) {
      console.error('获取指标数据失败:', error);
    }
  };

  const handleMetricChange = (event: SelectChangeEvent) => {
    setSelectedMetric(event.target.value as keyof SystemMetrics);
    setMetricHistory([]); // 切换指标时清空历史数据
  };

  const selectedOption = metricOptions.find(option => option.key === selectedMetric);

  const chartData: ChartData<'line'> = {
    labels: metricHistory.map(item => 
      new Date(item.timestamp).toLocaleTimeString()
    ),
    datasets: [
      {
        label: selectedOption?.label || '',
        data: metricHistory.map(item => item.value),
        borderColor: selectedOption?.color || '#000',
        backgroundColor: `${selectedOption?.color}33` || '#00000033',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.parsed.y}${selectedOption?.unit || ''}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => `${value}${selectedOption?.unit || ''}`
        }
      }
    }
  };

  if (!isDebugMode) return null;

  return (
    <Card>
      <CardContent>
        <Box className="flex justify-between items-center mb-4">
          <Typography variant="h6">指标趋势图</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={selectedMetric}
              onChange={handleMetricChange}
            >
              {metricOptions.map(option => (
                <MenuItem key={option.key} value={option.key}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ height: 300 }}>
          <Line
            ref={chartRef}
            data={chartData}
            options={chartOptions}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
