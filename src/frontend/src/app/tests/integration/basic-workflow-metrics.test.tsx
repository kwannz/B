import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Basic Workflow Metrics', () => {
  const mockMetrics = {
    wallet_a: {
      api_latency: 100,
      error_rate: 0.05,
      system_health: 0.95
    },
    wallet_b: {
      api_latency: 90,
      error_rate: 0.04,
      system_health: 0.96
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (getWallet as jest.Mock).mockImplementation((botId) => 
      Promise.resolve(botId === 'bot-123' ? mockMetrics.wallet_a : mockMetrics.wallet_b));
  });

  it('validates basic metrics', async () => {
    await testRunner.runTest(async () => {
      render(<TestContext><AgentSelection /></TestContext>);
      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(2);
      });

      const metrics = {
        wallets: mockMetrics,
        comparison: {
          apiLatencyDiff: Math.abs(mockMetrics.wallet_a.api_latency - mockMetrics.wallet_b.api_latency),
          errorRateDiff: Math.abs(mockMetrics.wallet_a.error_rate - mockMetrics.wallet_b.error_rate)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.comparison.apiLatencyDiff).toBeLessThan(20);
      expect(metrics.comparison.errorRateDiff).toBeLessThan(0.02);
    });
  });
});
