import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMetricsContext } from '../hooks/useMetricsContext';

export const TradingDashboard = () => {
  const { metrics } = useMetricsContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div data-testid="performance-metrics">
          <div>Success Rate: {metrics?.performance?.successRate || 0}%</div>
          <div>API Latency: {metrics?.performance?.apiLatency || 0}ms</div>
          <div>System Health: {metrics?.performance?.systemHealth || 0}</div>
        </div>
      </CardContent>
    </Card>
  );
};
