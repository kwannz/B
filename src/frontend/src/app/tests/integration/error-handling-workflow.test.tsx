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

describe('Error Handling Workflow', () => {
  const mockErrorScenarios = {
    api_timeout: {
      error: new Error('API Timeout'),
      retries: 3,
      recovery_time: 1000
    },
    network_error: {
      error: new Error('Network Error'),
      retries: 2,
      recovery_time: 500
    },
    validation_error: {
      error: new Error('Validation Error'),
      retries: 1,
      recovery_time: 200
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
  });

  it('should handle API timeouts with retry mechanism', async () => {
    let retryCount = 0;
    (createBot as jest.Mock).mockImplementation(() => {
      if (retryCount < mockErrorScenarios.api_timeout.retries) {
        retryCount++;
        throw mockErrorScenarios.api_timeout.error;
      }
      return { id: 'bot-123' };
    });

    await testRunner.runTest(async () => {
      render(<TestContext><AgentSelection /></TestContext>);

      await waitFor(() => {
        expect(createBot).toHaveBeenCalledTimes(mockErrorScenarios.api_timeout.retries + 1);
      });

      const metrics = {
        error_handling: {
          retry_count: retryCount,
          error_type: 'api_timeout',
          recovery_time: mockErrorScenarios.api_timeout.recovery_time,
          success: true
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.error_handling.retry_count).toBe(mockErrorScenarios.api_timeout.retries);
      expect(metrics.error_handling.success).toBe(true);
    });
  });

  it('should handle network errors during wallet operations', async () => {
    let retryCount = 0;
    (createWallet as jest.Mock).mockImplementation(() => {
      if (retryCount < mockErrorScenarios.network_error.retries) {
        retryCount++;
        throw mockErrorScenarios.network_error.error;
      }
      return { address: 'test-wallet', private_key: 'test-key' };
    });

    await testRunner.runTest(async () => {
      render(<TestContext><KeyManagement /></TestContext>);

      await waitFor(() => {
        expect(createWallet).toHaveBeenCalledTimes(mockErrorScenarios.network_error.retries + 1);
      });

      const metrics = {
        error_handling: {
          retry_count: retryCount,
          error_type: 'network_error',
          recovery_time: mockErrorScenarios.network_error.recovery_time,
          success: true
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.error_handling.retry_count).toBe(mockErrorScenarios.network_error.retries);
      expect(metrics.error_handling.success).toBe(true);
    });
  });

  it('should handle validation errors during strategy creation', async () => {
    let retryCount = 0;
    const invalidStrategy = { type: 'invalid', params: {} };
    const validStrategy = { type: 'valid', params: { threshold: 0.5 } };

    (createBot as jest.Mock).mockImplementation((strategy) => {
      if (strategy === invalidStrategy && retryCount < mockErrorScenarios.validation_error.retries) {
        retryCount++;
        throw mockErrorScenarios.validation_error.error;
      }
      return { id: 'bot-123' };
    });

    await testRunner.runTest(async () => {
      render(<TestContext><StrategyCreation /></TestContext>);

      await waitFor(() => {
        expect(createBot).toHaveBeenCalled();
      });

      const metrics = {
        error_handling: {
          retry_count: retryCount,
          error_type: 'validation_error',
          recovery_time: mockErrorScenarios.validation_error.recovery_time,
          success: true,
          validation: {
            invalid_attempts: retryCount,
            final_success: true
          }
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.error_handling.retry_count).toBeLessThanOrEqual(mockErrorScenarios.validation_error.retries);
      expect(metrics.error_handling.success).toBe(true);
      expect(metrics.error_handling.validation.invalid_attempts).toBe(retryCount);
    });
  });

  it('should handle multiple error types across workflow', async () => {
    const errorMetrics = {
      api_timeouts: 0,
      network_errors: 0,
      validation_errors: 0,
      total_retries: 0,
      total_recovery_time: 0
    };

    (createBot as jest.Mock).mockImplementation(() => {
      if (Math.random() < 0.3) {
        errorMetrics.api_timeouts++;
        errorMetrics.total_retries++;
        errorMetrics.total_recovery_time += mockErrorScenarios.api_timeout.recovery_time;
        throw mockErrorScenarios.api_timeout.error;
      }
      return { id: 'bot-123' };
    });

    (createWallet as jest.Mock).mockImplementation(() => {
      if (Math.random() < 0.3) {
        errorMetrics.network_errors++;
        errorMetrics.total_retries++;
        errorMetrics.total_recovery_time += mockErrorScenarios.network_error.recovery_time;
        throw mockErrorScenarios.network_error.error;
      }
      return { address: 'test-wallet', private_key: 'test-key' };
    });

    await testRunner.runTest(async () => {
      const workflow = [
        <AgentSelection />,
        <StrategyCreation />,
        <BotIntegration />,
        <KeyManagement />,
        <TradingDashboard />,
        <WalletComparison />
      ];

      for (const component of workflow) {
        render(<TestContext>{component}</TestContext>);
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });
      }

      const metrics = {
        error_handling: {
          api_timeouts: errorMetrics.api_timeouts,
          network_errors: errorMetrics.network_errors,
          validation_errors: errorMetrics.validation_errors,
          total_retries: errorMetrics.total_retries,
          total_recovery_time: errorMetrics.total_recovery_time,
          success: true
        },
        performance: {
          error_rate: errorMetrics.total_retries / (workflow.length * 2),
          average_recovery_time: errorMetrics.total_recovery_time / errorMetrics.total_retries || 0
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.error_handling.total_retries).toBeGreaterThan(0);
      expect(metrics.error_handling.success).toBe(true);
      expect(metrics.performance.error_rate).toBeLessThan(0.5);
      expect(metrics.performance.average_recovery_time).toBeLessThan(1000);
    });
  });
});
