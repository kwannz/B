import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useMetricsContext } from '@/app/hooks/useMetricsContext';
import { TradingDashboard } from '@/app/components/TradingDashboard';
import { StrategyForm } from '@/app/components/StrategyForm';
import type { TradingMetrics } from '@/app/types/trading';

export default function MemeCoinPage() {
  const { metrics } = useMetricsContext<TradingMetrics>();

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Meme Coin Trading</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TradingDashboard />
            <StrategyForm tradingType="meme-coin" />
          </div>
          <div className="mt-4" data-testid="performance-metrics">
            <div>Success Rate: {metrics?.performance?.successRate || 0}%</div>
            <div>API Latency: {metrics?.performance?.apiLatency || 0}ms</div>
            <div>System Health: {metrics?.performance?.systemHealth || 0}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
