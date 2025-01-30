import { Box, Card, CardContent, Grid, Typography, LinearProgress } from '@mui/material';
import { useDebug } from '../contexts/DebugContext';
import { useMetricsAnalyzer } from '../hooks/useMetricsAnalyzer';
import { useMetricsConfiguration } from '../hooks/useMetricsConfiguration';

export const DebugMetrics = () => {
  const { isDebugMode } = useDebug();
  const config = useMetricsConfiguration();
  const analyzer = useMetricsAnalyzer({
    update_interval: 5000,
    window_size: 100,
    thresholds: config.config.thresholds
  });

  if (!isDebugMode) return null;

  const analysis = analyzer.getLatestAnalysis();
  if (!analysis) return null;

  const formatScore = (score: number) => `${(score * 100).toFixed(1)}%`;

  const getScoreColor = (score: number) => {
    if (score > 0.8) return 'success.main';
    if (score > 0.6) return 'warning.main';
    return 'error.main';
  };

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Health
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Health Score: {formatScore(analysis.system.health_score)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={analysis.system.health_score * 100}
                  color={analysis.system.health_score > 0.8 ? 'success' : analysis.system.health_score > 0.6 ? 'warning' : 'error'}
                  sx={{ mt: 1 }}
                />
              </Box>
              <Typography variant="body2">
                CPU: {formatScore(analysis.system.resource_usage.cpu)}
              </Typography>
              <Typography variant="body2">
                Memory: {formatScore(analysis.system.resource_usage.memory)}
              </Typography>
              {analysis.system.performance_issues.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="error">
                    Issues Detected:
                  </Typography>
                  {analysis.system.performance_issues.map((issue, index) => (
                    <Typography key={index} variant="body2" color={issue.severity === 'error' ? 'error' : 'warning'}>
                      • {issue.message}
                    </Typography>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Market Analysis
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Efficiency Score: {formatScore(analysis.market.efficiency_score)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={analysis.market.efficiency_score * 100}
                  sx={{ mt: 1, '& .MuiLinearProgress-bar': { bgcolor: getScoreColor(analysis.market.efficiency_score) } }}
                />
              </Box>
              <Typography variant="body2">
                Volatility: {(analysis.market.volatility * 100).toFixed(2)}%
              </Typography>
              <Typography variant="body2">
                Trend: {analysis.market.signals.trend} (Strength: {(analysis.market.signals.strength * 100).toFixed(1)}%)
              </Typography>
              <Typography variant="body2">
                Volume: {analysis.market.signals.volume_profile}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trading Performance
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Performance Score: {formatScore(analysis.trading.performance_score)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={analysis.trading.performance_score * 100}
                  sx={{ mt: 1, '& .MuiLinearProgress-bar': { bgcolor: getScoreColor(analysis.trading.performance_score) } }}
                />
              </Box>
              <Typography variant="body2">
                Fill Rate: {formatScore(analysis.trading.execution_metrics.fill_rate)}
              </Typography>
              <Typography variant="body2">
                Success Rate: {formatScore(analysis.trading.execution_metrics.success_rate)}
              </Typography>
              <Typography variant="body2">
                Slippage: {analysis.trading.execution_metrics.slippage.toFixed(2)}%
              </Typography>
              <Typography variant="body2">
                Latency: {analysis.trading.execution_metrics.latency}ms
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
