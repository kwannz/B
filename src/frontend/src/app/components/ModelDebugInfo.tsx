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
  Grid
} from '@mui/material';
import { useDebug } from '../contexts/DebugContext';
import { useLanguage } from '../contexts/LanguageContext';
import { modelService } from '../services/modelService';
import { modelConfig, debugConfig } from '../config/modelConfig';

interface ModelInfo {
  name: string;
  version: string;
  parameters: number;
  quantization: string;
  size: number;
}

interface ModelMetrics {
  requestCount: number;
  totalTokens: number;
  averageLatency: number;
  errorRate: number;
  lastError?: string;
}

export default function ModelDebugInfo() {
  const { isDebugMode, log } = useDebug();
  const { language } = useLanguage();
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [metrics, setMetrics] = useState<ModelMetrics>({
    requestCount: 0,
    totalTokens: 0,
    averageLatency: 0,
    errorRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDebugMode) return;

    const fetchModelInfo = async () => {
      try {
        setIsLoading(true);
        const info = await modelService.getModelInfo();
        setModelInfo(info);
        log('info', 'Model', '模型信息获取成功', info);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '获取模型信息失败';
        setError(errorMessage);
        log('error', 'Model', errorMessage, err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModelInfo();
    const interval = setInterval(fetchModelInfo, debugConfig.metrics.collectionInterval);
    return () => clearInterval(interval);
  }, [isDebugMode, log]);

  if (!isDebugMode) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {language === 'zh' ? '模型调试信息' : 'Model Debug Info'}
        </Typography>

        {isLoading && <LinearProgress />}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {modelInfo && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box className="space-y-4">
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {language === 'zh' ? '模型名称' : 'Model Name'}
                  </Typography>
                  <Typography>
                    {modelInfo.name}
                    <Chip
                      label={modelInfo.version}
                      size="small"
                      color="primary"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {language === 'zh' ? '模型规格' : 'Model Specs'}
                  </Typography>
                  <Box className="flex gap-2">
                    <Chip
                      label={`${(modelInfo.parameters / 1e9).toFixed(1)}B 参数`}
                      size="small"
                    />
                    <Chip
                      label={modelInfo.quantization}
                      size="small"
                    />
                    <Chip
                      label={`${(modelInfo.size / 1e9).toFixed(1)}GB`}
                      size="small"
                    />
                  </Box>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box className="space-y-4">
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {language === 'zh' ? '性能指标' : 'Performance Metrics'}
                  </Typography>
                  <Box className="grid grid-cols-2 gap-4">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {language === 'zh' ? '请求数' : 'Requests'}
                      </Typography>
                      <Typography>{metrics.requestCount}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {language === 'zh' ? '平均延迟' : 'Avg Latency'}
                      </Typography>
                      <Typography>{metrics.averageLatency.toFixed(0)}ms</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {language === 'zh' ? '总Token' : 'Total Tokens'}
                      </Typography>
                      <Typography>{metrics.totalTokens}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {language === 'zh' ? '错误率' : 'Error Rate'}
                      </Typography>
                      <Typography>{(metrics.errorRate * 100).toFixed(2)}%</Typography>
                    </Box>
                  </Box>
                </Box>

                {metrics.lastError && (
                  <Alert severity="error">
                    {metrics.lastError}
                  </Alert>
                )}
              </Box>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}
