'use client';

import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  LinearProgress, 
  Alert,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore,
  Refresh,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Memory,
  Storage,
  Speed,
  CloudQueue
} from '@mui/icons-material';
import { useDebug } from '../contexts/DebugContext';
import { useLanguage } from '../contexts/LanguageContext';
import { debugConfig } from '../config/modelConfig';

interface SystemStatus {
  healthy: boolean;
  message: string;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    temperature: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    latency: number;
  };
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  lastError?: string;
}

export default function SystemDebugInfo() {
  const { isDebugMode, log } = useDebug();
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: { usage: 0, temperature: 0, cores: 0 },
    memory: { total: 0, used: 0, free: 0 },
    disk: { total: 0, used: 0, free: 0 },
    network: { bytesIn: 0, bytesOut: 0, latency: 0 }
  });
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    healthy: true,
    message: ''
  });

  const fetchSystemMetrics = async () => {
    try {
      // 这里应该调用实际的API
      const response = await fetch('/api/system/metrics');
      const data = await response.json();
      setMetrics(data);
      log('info', 'System', '系统指标更新成功', data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取系统指标失败';
      log('error', 'System', errorMessage, err);
    }
  };

  const fetchServiceStatus = async () => {
    try {
      // 这里应该调用实际的API
      const response = await fetch('/api/system/services');
      const data = await response.json();
      setServices(data);
      log('info', 'System', '服务状态更新成功', data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取服务状态失败';
      log('error', 'System', errorMessage, err);
    }
  };

  const checkSystemHealth = async () => {
    try {
      // 这里应该调用实际的API
      const response = await fetch('/api/system/health');
      const data = await response.json();
      setSystemStatus(data);
      log('info', 'System', '系统健康检查完成', data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '系统健康检查失败';
      setError(errorMessage);
      log('error', 'System', errorMessage, err);
    }
  };

  useEffect(() => {
    if (!isDebugMode) return;

    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchSystemMetrics(),
        fetchServiceStatus(),
        checkSystemHealth()
      ]);
      setIsLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, debugConfig.metrics.collectionInterval);
    return () => clearInterval(interval);
  }, [isDebugMode]);

  if (!isDebugMode) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'running': return 'success';
      case 'stopped': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  return (
    <Card>
      <CardContent>
        <Box className="flex justify-between items-center mb-4">
          <Typography variant="h6">
            {language === 'zh' ? '系统调试信息' : 'System Debug Info'}
          </Typography>
          <Box className="flex items-center gap-2">
            <Chip
              icon={systemStatus.healthy ? <CheckCircle /> : <Warning />}
              label={systemStatus.message}
              color={systemStatus.healthy ? 'success' : 'warning'}
            />
            <Tooltip title={language === 'zh' ? '刷新' : 'Refresh'}>
              <IconButton onClick={() => fetchSystemMetrics()}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {isLoading && <LinearProgress />}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box className="space-y-4">
          {/* CPU & Memory */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box className="flex items-center gap-2">
                <Memory />
                <Typography>
                  {language === 'zh' ? 'CPU和内存' : 'CPU & Memory'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      CPU
                    </Typography>
                    <Box className="space-y-2">
                      <Box>
                        <Typography variant="caption">
                          {language === 'zh' ? '使用率' : 'Usage'}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={metrics.cpu.usage}
                          color={metrics.cpu.usage > 80 ? 'error' : 'primary'}
                        />
                        <Typography variant="body2">
                          {metrics.cpu.usage.toFixed(1)}%
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption">
                          {language === 'zh' ? '温度' : 'Temperature'}
                        </Typography>
                        <Typography>
                          {metrics.cpu.temperature}°C
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {language === 'zh' ? '内存' : 'Memory'}
                    </Typography>
                    <Box className="space-y-2">
                      <LinearProgress
                        variant="determinate"
                        value={(metrics.memory.used / metrics.memory.total) * 100}
                        color={metrics.memory.free < 1024 * 1024 * 1024 ? 'error' : 'primary'}
                      />
                      <Box className="flex justify-between">
                        <Typography variant="caption">
                          {language === 'zh' ? '已用' : 'Used'}: {formatBytes(metrics.memory.used)}
                        </Typography>
                        <Typography variant="caption">
                          {language === 'zh' ? '总计' : 'Total'}: {formatBytes(metrics.memory.total)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Storage & Network */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box className="flex items-center gap-2">
                <Storage />
                <Typography>
                  {language === 'zh' ? '存储和网络' : 'Storage & Network'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {language === 'zh' ? '存储' : 'Storage'}
                    </Typography>
                    <Box className="space-y-2">
                      <LinearProgress
                        variant="determinate"
                        value={(metrics.disk.used / metrics.disk.total) * 100}
                      />
                      <Box className="flex justify-between">
                        <Typography variant="caption">
                          {language === 'zh' ? '已用' : 'Used'}: {formatBytes(metrics.disk.used)}
                        </Typography>
                        <Typography variant="caption">
                          {language === 'zh' ? '总计' : 'Total'}: {formatBytes(metrics.disk.total)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {language === 'zh' ? '网络' : 'Network'}
                    </Typography>
                    <Box className="space-y-2">
                      <Box className="flex justify-between">
                        <Typography variant="caption">
                          ↓ {formatBytes(metrics.network.bytesIn)}/s
                        </Typography>
                        <Typography variant="caption">
                          ↑ {formatBytes(metrics.network.bytesOut)}/s
                        </Typography>
                      </Box>
                      <Typography variant="caption" display="block">
                        {language === 'zh' ? '延迟' : 'Latency'}: {metrics.network.latency}ms
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Services */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box className="flex items-center gap-2">
                <CloudQueue />
                <Typography>
                  {language === 'zh' ? '服务状态' : 'Services'}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box className="space-y-2">
                {services.map((service) => (
                  <Box
                    key={service.name}
                    className="flex justify-between items-center p-2 bg-gray-50 rounded"
                  >
                    <Box className="flex items-center gap-2">
                      <Chip
                        size="small"
                        label={service.status}
                        color={getStatusColor(service.status)}
                      />
                      <Typography>{service.name}</Typography>
                    </Box>
                    <Typography variant="caption">
                      {language === 'zh' ? '运行时间' : 'Uptime'}: {service.uptime}s
                    </Typography>
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </CardContent>
    </Card>
  );
}
