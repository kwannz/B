import { Box, Card, CardContent, Grid, Typography, CircularProgress, LinearProgress } from '@mui/material';
import { useMetricsStore } from '../stores/metricsStore';
import { DebugMetricsChart } from './DebugMetricsChart';
import { useDebugMetrics } from '../providers/DebugMetricsProvider';
import { DEBUG_CONFIG } from '../config/debug.config';

export const DebugMetricsDashboard = () => {
  const { getLatestMetrics } = useMetricsStore();
  const { exportMetrics } = useDebugMetrics();
  const metrics = getLatestMetrics();

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatDuration = (ms: number) => `${ms.toFixed(1)}ms`;

  const getHealthColor = (value: number, thresholds = { warning: 0.7, error: 0.9 }) => {
    if (value > thresholds.error) return 'error.main';
    if (value > thresholds.warning) return 'warning.main';
    return 'success.main';
  };

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>System Health</Typography>
              <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
                <CircularProgress
                  variant="determinate"
                  value={metrics.performance.systemHealth * 100}
                  size={80}
                  sx={{ color: getHealthColor(metrics.performance.systemHealth) }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="caption" component="div">
                    {formatPercentage(metrics.performance.systemHealth)}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2">
                Memory Usage: {formatPercentage(metrics.performance.memoryUsage)}
              </Typography>
              <Typography variant="body2">
                Error Rate: {formatPercentage(metrics.performance.errorRate)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Trading Performance</Typography>
              <Typography variant="body2" gutterBottom>
                Active Positions: {metrics.trading.activePositions}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Total Trades: {metrics.trading.totalTrades}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Success Rate
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={metrics.trading.successRate * 100}
                  color={metrics.trading.successRate > 0.7 ? 'success' : 'warning'}
                  sx={{ mt: 1 }}
                />
              </Box>
              <Typography variant="caption">
                Last Update: {new Date(metrics.wallet.lastUpdate).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>API Performance</Typography>
              <Typography variant="body2" gutterBottom>
                Latency: {formatDuration(metrics.performance.apiLatency)}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Health Status
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(1 - metrics.performance.errorRate) * 100}
                  color={metrics.performance.errorRate < 0.05 ? 'success' : 'error'}
                  sx={{ mt: 1 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <DebugMetricsChart />
        </Grid>
      </Grid>
    </Box>
  );
};
