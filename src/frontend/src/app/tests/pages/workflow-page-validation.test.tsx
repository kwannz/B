import { render, screen, waitFor } from '@testing-library/react';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('@/app/api/client');

describe('Workflow Page Validation', () => {
  const mockSystemMetrics = {
    heap_used: 0.5,
    heap_total: 0.8,
    external_memory: 0.2,
    event_loop_lag: 10,
    active_handles: 50,
    active_requests: 20,
    garbage_collection: {
      count: 5,
      duration: 100
    }
  };

  const mockWallet = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    balance: 1.5,
    metrics: {
      api_latency: 100,
      error_rate: 0.05,
      success_rate: 0.95,
      throughput: 100,
      active_trades: 5,
      total_volume: 10000,
      profit_loss: 500,
      system: mockSystemMetrics
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (createWallet as jest.Mock).mockResolvedValue(mockWallet);
    (getWallet as jest.Mock).mockResolvedValue(mockWallet);
    (getBotStatus as jest.Mock).mockResolvedValue({ status: 'active', trades: [] });
  });

  describe('AgentSelection Page', () => {
    it('validates agent selection page with performance metrics', async () => {
      const startTime = Date.now();
      render(<TestContext><AgentSelection /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('agent-selection')).toBeInTheDocument();
        expect(screen.getByText(/Trading Agent/i)).toBeInTheDocument();
        expect(screen.getByText(/DeFi Agent/i)).toBeInTheDocument();
      });

      const endTime = Date.now();
      const metrics = {
        render_duration: endTime - startTime,
        component_loaded: true,
        elements_visible: {
          trading_agent: screen.queryByText(/Trading Agent/i) !== null,
          defi_agent: screen.queryByText(/DeFi Agent/i) !== null
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.render_duration).toBeLessThan(1000);
      expect(metrics.elements_visible.trading_agent).toBe(true);
      expect(metrics.elements_visible.defi_agent).toBe(true);
    });
  });

  describe('StrategyCreation Page', () => {
    it('validates strategy creation page with performance metrics', async () => {
      const startTime = Date.now();
      render(<TestContext><StrategyCreation /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('strategy-creation')).toBeInTheDocument();
        expect(screen.getByTestId('strategy-form')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const metrics = {
        render_duration: endTime - startTime,
        component_loaded: true,
        form_elements: {
          strategy_input: screen.queryByTestId('strategy-form') !== null,
          submit_button: screen.queryByRole('button', { name: /create/i }) !== null
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.render_duration).toBeLessThan(1000);
      expect(metrics.form_elements.strategy_input).toBe(true);
      expect(metrics.form_elements.submit_button).toBe(true);
    });
  });

  describe('BotIntegration Page', () => {
    it('validates bot integration page with performance metrics', async () => {
      const startTime = Date.now();
      render(<TestContext><BotIntegration /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('bot-integration')).toBeInTheDocument();
        expect(screen.getByTestId('bot-status')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const metrics = {
        render_duration: endTime - startTime,
        component_loaded: true,
        elements_visible: {
          status_display: screen.queryByTestId('bot-status') !== null,
          controls: screen.queryByTestId('bot-controls') !== null
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.render_duration).toBeLessThan(1000);
      expect(metrics.elements_visible.status_display).toBe(true);
      expect(metrics.elements_visible.controls).toBe(true);
    });
  });

  describe('KeyManagement Page', () => {
    it('validates key management page with performance metrics', async () => {
      const startTime = Date.now();
      render(<TestContext><KeyManagement /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('key-management')).toBeInTheDocument();
        expect(screen.getByTestId('wallet-display')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const metrics = {
        render_duration: endTime - startTime,
        component_loaded: true,
        elements_visible: {
          wallet_display: screen.queryByTestId('wallet-display') !== null,
          key_display: screen.queryByTestId('key-display') !== null
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.render_duration).toBeLessThan(1000);
      expect(metrics.elements_visible.wallet_display).toBe(true);
      expect(metrics.elements_visible.key_display).toBe(true);
    });
  });

  describe('TradingDashboard Page', () => {
    it('validates trading dashboard page with performance metrics', async () => {
      const startTime = Date.now();
      render(<TestContext><TradingDashboard /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('trading-dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('trading-history')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const metrics = {
        render_duration: endTime - startTime,
        component_loaded: true,
        elements_visible: {
          status_display: screen.queryByTestId('trading-status') !== null,
          history_display: screen.queryByTestId('trading-history') !== null,
          performance_metrics: screen.queryByTestId('performance-metrics') !== null
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.render_duration).toBeLessThan(1000);
      expect(metrics.elements_visible.status_display).toBe(true);
      expect(metrics.elements_visible.history_display).toBe(true);
      expect(metrics.elements_visible.performance_metrics).toBe(true);
    });
  });

  describe('WalletComparison Page', () => {
    it('validates wallet comparison page with performance metrics', async () => {
      const startTime = Date.now();
      render(<TestContext><WalletComparison /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const metrics = {
        render_duration: endTime - startTime,
        component_loaded: true,
        elements_visible: {
          comparison_display: screen.queryByTestId('wallet-comparison') !== null,
          metrics_display: screen.queryByTestId('comparison-metrics') !== null
        }
      };

      testRunner.expectMetrics(metrics);
      expect(metrics.render_duration).toBeLessThan(1000);
      expect(metrics.elements_visible.comparison_display).toBe(true);
      expect(metrics.elements_visible.metrics_display).toBe(true);
    });
  });

  describe('Complete Workflow Navigation', () => {
    it('validates complete workflow navigation with performance metrics', async () => {
      const workflowData: any[] = [];
      const startTime = Date.now();

      const pages = [
        { component: AgentSelection, testId: 'agent-selection' },
        { component: StrategyCreation, testId: 'strategy-creation' },
        { component: BotIntegration, testId: 'bot-integration' },
        { component: KeyManagement, testId: 'key-management' },
        { component: TradingDashboard, testId: 'trading-dashboard' },
        { component: WalletComparison, testId: 'wallet-comparison' }
      ];

      for (const page of pages) {
        const pageStartTime = Date.now();
        render(<TestContext><page.component /></TestContext>);

        await waitFor(() => {
          expect(screen.getByTestId(page.testId)).toBeInTheDocument();
        });

        const pageEndTime = Date.now();
        workflowData.push({
          page: page.testId,
          duration: pageEndTime - pageStartTime
        });
      }

      const endTime = Date.now();
      const workflowMetrics = {
        total_duration: endTime - startTime,
        pages_completed: workflowData.length,
        workflow_data: workflowData,
        performance_metrics: {
          average_page_duration: workflowData.reduce((acc, data) => acc + data.duration, 0) / workflowData.length,
          page_duration_variance: calculateVariance(workflowData.map(data => data.duration)),
          page_durations: workflowData.reduce((acc, data) => {
            acc[data.page] = data.duration;
            return acc;
          }, {} as Record<string, number>)
        }
      };

      testRunner.expectMetrics(workflowMetrics);
      expect(workflowMetrics.total_duration).toBeLessThan(6000);
      expect(workflowMetrics.performance_metrics.average_page_duration).toBeLessThan(1000);
      workflowData.forEach(data => {
        expect(data.duration).toBeLessThan(1000);
      });
    });
  });
});

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}
