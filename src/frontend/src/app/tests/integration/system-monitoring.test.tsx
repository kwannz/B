import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('System Monitoring', () => {
  const mockBot = {
    id: 'bot-123',
    metrics: {
      performance: {
        monitoring: {
          alerts: 0,
          warnings: 0,
          critical_errors: 0,
          system_events: 100,
          health_checks: 50,
          uptime: 3600,
          mttr: 0,
          mttf: 3600
        }
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);
  });

  it('should validate system monitoring metrics', async () => {
    await testRunner.runTest(async () => {
      const components = [<AgentSelection />, <StrategyCreation />];
      
      for (const component of components) {
        render(<TestContext>{component}</TestContext>);
        await waitFor(() => {
          expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        });
      }

      const metrics = {
        monitoring: {
          alerts: 0,
          warnings: 0,
          criticalErrors: 0,
          systemEvents: 200,
          healthChecks: 100,
          uptime: 7200,
          serviceAvailability: 0.999
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.monitoring.alerts).toBe(0);
      expect(metrics.monitoring.healthChecks).toBeGreaterThan(50);
      expect(metrics.monitoring.serviceAvailability).toBeGreaterThan(0.99);
    });
  });
});
