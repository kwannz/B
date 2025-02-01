import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMetricsContext } from '../hooks/useMetricsContext';

export const WalletComparison = () => {
  const { metrics } = useMetricsContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div data-testid="performance-metrics">
          <div>Wallet A Balance: {metrics?.wallets?.wallet_a?.balance || 0} SOL</div>
          <div>Wallet B Balance: {metrics?.wallets?.wallet_b?.balance || 0} SOL</div>
          <div>Performance Difference: {metrics?.comparison?.performance || 0}%</div>
        </div>
      </CardContent>
    </Card>
  );
};
