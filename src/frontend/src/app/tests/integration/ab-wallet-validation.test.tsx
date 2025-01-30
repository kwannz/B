import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet, transferSOL } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('AB Wallet Validation', () => {
  const mockWalletA = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    balance: 1.5,
    transactions: [
      { type: 'trade', amount: 0.1, timestamp: Date.now() }
    ],
    metrics: {
      api_latency: 100,
      error_rate: 0.05,
      system_health: 0.95,
      memory_usage: 0.4,
      cpu_usage: 0.3,
      network_latency: 50,
      throughput: 100,
      response_time: 200
    }
  };

  const mockWalletB = {
    address: '7MmPb3RLvEgtg4HQY8gguARGwGKyYaCeT8DLvBwfLL',
    balance: 2.0,
    transactions: [
      { type: 'trade', amount: 0.2, timestamp: Date.now() }
    ],
    metrics: {
      api_latency: 90,
      error_rate: 0.04,
      system_health: 0.96,
      memory_usage: 0.35,
      cpu_usage: 0.25,
      network_latency: 45,
      throughput: 110,
      response_time: 180
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (getBotStatus as jest.Mock).mockResolvedValue({ id: 'bot-123', status: 'active' });
    (createWallet as jest.Mock)
      .mockImplementation((botId) => Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
    (getWallet as jest.Mock)
      .mockImplementation((botId) => Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB));
    (transferSOL as jest.Mock).mockResolvedValue({ success: true });
  });

  it('should validate AB wallet comparison metrics', async () => {
    await testRunner.runTest(async () => {
      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      });

      const metrics = {
        wallets: {
          wallet_a: mockWalletA.metrics,
          wallet_b: mockWalletB.metrics
        },
        comparison: {
          api_latency_diff: Math.abs(mockWalletA.metrics.api_latency - mockWalletB.metrics.api_latency),
          error_rate_diff: Math.abs(mockWalletA.metrics.error_rate - mockWalletB.metrics.error_rate),
          system_health_diff: Math.abs(mockWalletA.metrics.system_health - mockWalletB.metrics.system_health),
          memory_usage_diff: Math.abs(mockWalletA.metrics.memory_usage - mockWalletB.metrics.memory_usage),
          cpu_usage_diff: Math.abs(mockWalletA.metrics.cpu_usage - mockWalletB.metrics.cpu_usage),
          network_latency_diff: Math.abs(mockWalletA.metrics.network_latency - mockWalletB.metrics.network_latency),
          throughput_diff: Math.abs(mockWalletA.metrics.throughput - mockWalletB.metrics.throughput),
          response_time_diff: Math.abs(mockWalletA.metrics.response_time - mockWalletB.metrics.response_time)
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.comparison.api_latency_diff).toBeLessThan(20);
      expect(metrics.comparison.error_rate_diff).toBeLessThan(0.02);
      expect(metrics.comparison.system_health_diff).toBeLessThan(0.02);
      expect(metrics.comparison.memory_usage_diff).toBeLessThan(0.1);
      expect(metrics.comparison.cpu_usage_diff).toBeLessThan(0.1);
      expect(metrics.comparison.network_latency_diff).toBeLessThan(10);
      expect(metrics.comparison.throughput_diff).toBeLessThan(20);
      expect(metrics.comparison.response_time_diff).toBeLessThan(30);
    });
  });

  it('should validate AB wallet performance under load', async () => {
    await testRunner.runTest(async () => {
      const operations = Promise.all([1, 2, 3].map(() => 
        render(
          <TestContext>
            <WalletComparison />
          </TestContext>
        )
      ));

      await operations;

      await waitFor(() => {
        expect(screen.getAllByTestId('performance-metrics')).toHaveLength(3);
      });

      const metrics = {
        wallets: {
          wallet_a: {
            ...mockWalletA.metrics,
            api_latency: 120,
            error_rate: 0.06,
            system_health: 0.93,
            memory_usage: 0.5,
            cpu_usage: 0.4
          },
          wallet_b: {
            ...mockWalletB.metrics,
            api_latency: 110,
            error_rate: 0.05,
            system_health: 0.94,
            memory_usage: 0.45,
            cpu_usage: 0.35
          }
        },
        comparison: {
          api_latency_diff: 10,
          error_rate_diff: 0.01,
          system_health_diff: 0.01,
          memory_usage_diff: 0.05,
          cpu_usage_diff: 0.05
        },
        load_metrics: {
          average_latency: 115,
          average_error_rate: 0.055,
          average_system_health: 0.935,
          average_memory_usage: 0.475,
          average_cpu_usage: 0.375
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.comparison.api_latency_diff).toBeLessThan(20);
      expect(metrics.comparison.error_rate_diff).toBeLessThan(0.02);
      expect(metrics.comparison.system_health_diff).toBeLessThan(0.02);
      expect(metrics.comparison.memory_usage_diff).toBeLessThan(0.1);
      expect(metrics.comparison.cpu_usage_diff).toBeLessThan(0.1);
      expect(metrics.load_metrics.average_latency).toBeLessThan(150);
      expect(metrics.load_metrics.average_error_rate).toBeLessThan(0.1);
      expect(metrics.load_metrics.average_system_health).toBeGreaterThan(0.9);
      expect(metrics.load_metrics.average_memory_usage).toBeLessThan(0.6);
      expect(metrics.load_metrics.average_cpu_usage).toBeLessThan(0.5);
    });
  });
});
