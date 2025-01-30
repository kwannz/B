import { Box, Card, CardContent, Typography, Grid } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDebugMetrics } from '../providers/DebugMetricsProvider';
import { useMetricsStore } from '../hooks/useMetricsStore';
import { useMetricsAnalyzer } from '../hooks/useMetricsAnalyzer';
import { DEBUG_CONFIG } from '../config/debug.config';

export const DebugMetricsChart = () => {
  const { getMetricsSnapshot } = useDebugMetrics();
  const metrics = useMetricsStore(state => state.metrics);
  const analyzer = useMetricsAnalyzer();

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getChartData = () => {
    const snapshot = getMetricsSnapshot();
    return snapshot.map((entry: any) => ({
      timestamp: entry.timestamp,
      apiLatency: entry.performance?.apiLatency || 0,
      errorRate: entry.errors / entry.total || 0,
      systemHealth: analyzer.getSystemHealth(entry),
      memoryUsage: entry.performance?.memory?.usedJSHeapSize / entry.performance?.memory?.jsHeapSizeLimit || 0
    }));
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>API Performance Trends</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getChartData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={formatTimestamp}
                    interval="preserveEnd"
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={formatTimestamp}
                    formatter={(value: number) => value.toFixed(3)}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="apiLatency" 
                    stroke={DEBUG_CONFIG.visualization.chart_colors.primary} 
                    name="API Latency (ms)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="errorRate" 
                    stroke={DEBUG_CONFIG.visualization.chart_colors.error} 
                    name="Error Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>System Health Metrics</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getChartData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={formatTimestamp}
                    interval="preserveEnd"
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={formatTimestamp}
                    formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="systemHealth" 
                    stroke={DEBUG_CONFIG.visualization.chart_colors.success} 
                    name="System Health"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="memoryUsage" 
                    stroke={DEBUG_CONFIG.visualization.chart_colors.warning} 
                    name="Memory Usage"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
