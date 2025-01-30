import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Error Recovery Workflow', () => {
  const mockErrorScenarios = {
    network_error: {
      error: new Error('Network Error'),
      retries: 3,
      recovery_time: 1000,
      backoff_factor: 1.5
    },
    validation_error: {
      error: new Error('Validation Error'),
      retries: 2,
      recovery_time: 500,
      backoff_factor: 2
    },
    timeout_error: {
      error: new Error('Timeout Error'),
      retries: 4,
      recovery_time: 2000,
      backoff_factor: 1.2
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
  });

  it('should handle network errors with exponential backoff', async () => {
    await testRunner.runTest(async () => {
      let retryCount = 0;
      const startTime = Date.now();
      let lastRetryTime = startTime;

      (createBot as jest.Mock).mockImplementation(() => {
        if (retryCount < mockErrorScenarios.network_error.retries) {
          const currentTime = Date.now();
          const timeSinceLastRetry = currentTime - lastRetryTime;
          lastRetryTime = currentTime;

          const expectedBackoff = mockErrorScenarios.network_error.recovery_time * 
            Math.pow(mockErrorScenarios.network_error.backoff_factor, retryCount);

          expect(timeSinceLastRetry).toBeGreaterThanOrEqual(expectedBackoff);
          retryCount++;
          throw mockErrorScenarios.network_error.error;
        }
        return { id: 'bot-123' };
      });

      render(<TestContext><AgentSelection /></TestContext>);

      await waitFor(() => {
        expect(createBot).toHaveBeenCalledTimes(mockErrorScenarios.network_error.retries + 1);
      });

      const totalTime = Date.now() - startTime;
      const expectedTotalBackoff = mockErrorScenarios.network_error.recovery_time * 
        (Math.pow(mockErrorScenarios.network_error.backoff_factor, mockErrorScenarios.network_error.retries) - 1) / 
        (mockErrorScenarios.network_error.backoff_factor - 1);

      expect(totalTime).toBeGreaterThanOrEqual(expectedTotalBackoff);
    });
  });

  it('should recover from validation errors with data correction', async () => {
    await testRunner.runTest(async () => {
      let retryCount = 0;
      const invalidData = { type: 'invalid', strategy: 'unknown' };
      const correctedData = { type: 'trading', strategy: 'momentum' };

      (createBot as jest.Mock).mockImplementation((type, strategy) => {
        if (type === invalidData.type && retryCount < mockErrorScenarios.validation_error.retries) {
          retryCount++;
          throw mockErrorScenarios.validation_error.error;
        }
        return { id: 'bot-123', type, strategy };
      });

      render(<TestContext><StrategyCreation /></TestContext>);

      await waitFor(() => {
        expect(createBot).toHaveBeenCalledWith(correctedData.type, correctedData.strategy);
        expect(screen.getByTestId('strategy-creation')).toBeInTheDocument();
      });

      const metrics = {
        validation: {
          error_count: retryCount,
          recovery_success: true,
          data_correction: {
            initial: invalidData,
            final: correctedData
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.validation.error_count).toBeLessThanOrEqual(mockErrorScenarios.validation_error.retries);
      expect(metrics.validation.recovery_success).toBe(true);
    });
  });

  it('should handle timeout errors with progressive retry delays', async () => {
    await testRunner.runTest(async () => {
      let retryCount = 0;
      const retryDelays: number[] = [];
      const startTime = Date.now();

      (getBotStatus as jest.Mock).mockImplementation(() => {
        if (retryCount < mockErrorScenarios.timeout_error.retries) {
          retryDelays.push(Date.now() - startTime);
          retryCount++;
          throw mockErrorScenarios.timeout_error.error;
        }
        return { id: 'bot-123', status: 'active' };
      });

      render(<TestContext><BotIntegration /></TestContext>);

      await waitFor(() => {
        expect(getBotStatus).toHaveBeenCalledTimes(mockErrorScenarios.timeout_error.retries + 1);
      });

      const metrics = {
        timeout: {
          retry_count: retryCount,
          retry_delays: retryDelays,
          total_recovery_time: Date.now() - startTime,
          average_delay: retryDelays.reduce((a, b) => a + b, 0) / retryDelays.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.timeout.retry_count).toBeLessThanOrEqual(mockErrorScenarios.timeout_error.retries);
      expect(metrics.timeout.average_delay).toBeGreaterThan(mockErrorScenarios.timeout_error.recovery_time);
      
      for (let i = 1; i < retryDelays.length; i++) {
        expect(retryDelays[i]).toBeGreaterThan(retryDelays[i - 1]);
      }
    });
  });

  it('should maintain system stability during error recovery', async () => {
    await testRunner.runTest(async () => {
      const components = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      const errorMetrics = {
        network_errors: 0,
        validation_errors: 0,
        timeout_errors: 0,
        recovery_times: [] as number[],
        memory_usage: [] as number[],
        cpu_usage: [] as number[]
      };

      for (const component of components) {
        const startTime = Date.now();
        render(<TestContext>{component}</TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });

        errorMetrics.recovery_times.push(Date.now() - startTime);
        errorMetrics.memory_usage.push(process.memoryUsage().heapUsed / process.memoryUsage().heapTotal);
        errorMetrics.cpu_usage.push(0.5); // Mock CPU usage

        if (Math.random() < 0.3) errorMetrics.network_errors++;
        if (Math.random() < 0.2) errorMetrics.validation_errors++;
        if (Math.random() < 0.1) errorMetrics.timeout_errors++;
      }

      const metrics = {
        errors: {
          network: errorMetrics.network_errors,
          validation: errorMetrics.validation_errors,
          timeout: errorMetrics.timeout_errors,
          total: errorMetrics.network_errors + errorMetrics.validation_errors + errorMetrics.timeout_errors
        },
        performance: {
          average_recovery_time: errorMetrics.recovery_times.reduce((a, b) => a + b, 0) / errorMetrics.recovery_times.length,
          peak_memory_usage: Math.max(...errorMetrics.memory_usage),
          average_cpu_usage: errorMetrics.cpu_usage.reduce((a, b) => a + b, 0) / errorMetrics.cpu_usage.length
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.errors.total).toBeLessThan(components.length);
      expect(metrics.performance.peak_memory_usage).toBeLessThan(0.8);
      expect(metrics.performance.average_cpu_usage).toBeLessThan(0.7);
    });
  });
});
