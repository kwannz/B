import { Box, Card, CardContent, Grid, Typography, LinearProgress, CircularProgress } from '@mui/material';
import { useDebug } from '../contexts/DebugContext';
import { useMetricsStore } from '../hooks/useMetricsStore';
import { useMetricsAnalyzer } from '../hooks/useMetricsAnalyzer';

export const DebugMetricsVisualizer = () => {
  const { isDebugMode } = useDebug();
  const metrics = useMetricsStore(state => state.metrics);
  const analyzer = useMetricsAnalyzer();

  if (!isDebugMode) return null;

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatDuration = (ms: number) => `${ms.toFixed(1)}ms`;

  const getHealthColor = (value: number) => {
    if (value > 0.8) return 'success.main';
    if (value > 0.6) return 'warning.main';
    return 'error.main';
  };

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>API Performance</Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Success Rate: {formatPercentage(1 - (metrics.errors / metrics.total))}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(1 - (metrics.errors / metrics.total)) * 100}
                  color={metrics.errors === 0 ? 'success' : 'warning'}
                  sx={{ mt: 1 }}
                />
              </Box>
              <Typography variant="body2">
                Average Duration: {formatDuration(metrics.avgDuration)}
              </Typography>
              <Typography variant="body2">
                Total Requests: {metrics.total}
              </Typography>
              <Typography variant="body2">
                Error Count: {metrics.errors}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>System Health</Typography>
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress
                  variant="determinate"
                  value={analyzer.getSystemHealth() * 100}
                  size={80}
                  sx={{ color: getHealthColor(analyzer.getSystemHealth()) }}
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
                  <Typography variant="caption" component="div" color="text.secondary">
                    {formatPercentage(analyzer.getSystemHealth())}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Memory Usage: {formatPercentage(metrics.performance?.memory?.usedJSHeapSize / metrics.performance?.memory?.jsHeapSizeLimit || 0)}
                </Typography>
                <Typography variant="body2">
                  Last Update: {new Date(metrics.lastUpdate).toLocaleTimeString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Endpoint Performance</Typography>
              {Object.entries(analyzer.getEndpointMetrics()).map(([endpoint, data]) => (
                <Box key={endpoint} sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {endpoint}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(1 - (data.errors / data.total)) * 100}
                    color={data.errors === 0 ? 'success' : 'warning'}
                    sx={{ mt: 1 }}
                  />
                  <Typography variant="caption" display="block">
                    Avg: {formatDuration(data.avgDuration)}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
