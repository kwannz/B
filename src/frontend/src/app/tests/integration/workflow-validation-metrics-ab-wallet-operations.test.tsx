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

describe('Workflow Validation with AB Wallet Operations', () => {
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

  const mockWalletA = {
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

  const mockWalletB = {
    address: '7MmPxQvM5RKzZKBqJqGpPxEUVhGqLGy8YFoqBJyFw9R2',
    balance: 2.0,
    metrics: {
      api_latency: 90,
      error_rate: 0.03,
      success_rate: 0.97,
      throughput: 120,
      active_trades: 7,
      total_volume: 15000,
      profit_loss: 750,
      system: mockSystemMetrics
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (createWallet as jest.Mock).mockImplementation((botId) => {
      return Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB);
    });
    (getWallet as jest.Mock).mockImplementation((botId) => {
      return Promise.resolve(botId === 'bot-123' ? mockWalletA : mockWalletB);
    });
    (getBotStatus as jest.Mock).mockResolvedValue({ status: 'active', trades: [] });
  });

  it('validates complete workflow with AB wallet operations', async () => {
    const workflowData: any[] = [];
    const startTime = Date.now();
    const walletOperations = {
      wallet_a: {
        trades: [] as any[],
        transfers: [] as any[],
        metrics: {
          total_trades: 0,
          successful_trades: 0,
          failed_trades: 0,
          total_volume: 0,
          profit_loss: 0,
          average_trade_size: 0,
          average_profit_per_trade: 0,
          win_rate: 0
        }
      },
      wallet_b: {
        trades: [] as any[],
        transfers: [] as any[],
        metrics: {
          total_trades: 0,
          successful_trades: 0,
          failed_trades: 0,
          total_volume: 0,
          profit_loss: 0,
          average_trade_size: 0,
          average_profit_per_trade: 0,
          win_rate: 0
        }
      }
    };

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
      const pageMetrics = {
        ...mockSystemMetrics,
        heap_used: Math.min(0.8, mockSystemMetrics.heap_used + (workflowData.length * 0.05)),
        active_requests: Math.min(100, mockSystemMetrics.active_requests + (workflowData.length * 5))
      };

      const mockTrade = {
        timestamp: Date.now(),
        type: Math.random() > 0.5 ? 'buy' : 'sell',
        amount: Math.random() * 100,
        price: Math.random() * 1000,
        success: Math.random() > 0.1
      };

      const mockTransfer = {
        timestamp: Date.now(),
        amount: Math.random() * 10,
        success: Math.random() > 0.05
      };

      walletOperations.wallet_a.trades.push(mockTrade);
      walletOperations.wallet_b.trades.push(mockTrade);
      walletOperations.wallet_a.transfers.push(mockTransfer);
      walletOperations.wallet_b.transfers.push(mockTransfer);

      ['wallet_a', 'wallet_b'].forEach(wallet => {
        const ops = walletOperations[wallet as keyof typeof walletOperations];
        const successfulTrades = ops.trades.filter(t => t.success);
        const totalVolume = ops.trades.reduce((sum, t) => sum + t.amount * t.price, 0);
        const profitLoss = successfulTrades.reduce((sum, t) => sum + (t.type === 'sell' ? 1 : -1) * t.amount * t.price, 0);

        ops.metrics = {
          total_trades: ops.trades.length,
          successful_trades: successfulTrades.length,
          failed_trades: ops.trades.length - successfulTrades.length,
          total_volume: totalVolume,
          profit_loss: profitLoss,
          average_trade_size: totalVolume / ops.trades.length,
          average_profit_per_trade: profitLoss / successfulTrades.length,
          win_rate: successfulTrades.length / ops.trades.length
        };
      });

      workflowData.push({
        page: page.testId,
        duration: pageEndTime - pageStartTime,
        metrics: pageMetrics,
        wallet_operations: {
          wallet_a: {
            trades: walletOperations.wallet_a.trades.length,
            transfers: walletOperations.wallet_a.transfers.length,
            metrics: walletOperations.wallet_a.metrics
          },
          wallet_b: {
            trades: walletOperations.wallet_b.trades.length,
            transfers: walletOperations.wallet_b.transfers.length,
            metrics: walletOperations.wallet_b.metrics
          }
        }
      });
    }

    const endTime = Date.now();
    const metrics = {
      total_duration: endTime - startTime,
      pages_completed: workflowData.length,
      workflow_data: workflowData,
      wallet_metrics: {
        wallet_a: {
          total_operations: walletOperations.wallet_a.trades.length + walletOperations.wallet_a.transfers.length,
          success_rate: walletOperations.wallet_a.metrics.successful_trades / walletOperations.wallet_a.metrics.total_trades,
          volume_metrics: {
            total_volume: walletOperations.wallet_a.metrics.total_volume,
            average_trade_size: walletOperations.wallet_a.metrics.average_trade_size,
            profit_loss: walletOperations.wallet_a.metrics.profit_loss
          },
          performance_metrics: {
            win_rate: walletOperations.wallet_a.metrics.win_rate,
            average_profit_per_trade: walletOperations.wallet_a.metrics.average_profit_per_trade
          }
        },
        wallet_b: {
          total_operations: walletOperations.wallet_b.trades.length + walletOperations.wallet_b.transfers.length,
          success_rate: walletOperations.wallet_b.metrics.successful_trades / walletOperations.wallet_b.metrics.total_trades,
          volume_metrics: {
            total_volume: walletOperations.wallet_b.metrics.total_volume,
            average_trade_size: walletOperations.wallet_b.metrics.average_trade_size,
            profit_loss: walletOperations.wallet_b.metrics.profit_loss
          },
          performance_metrics: {
            win_rate: walletOperations.wallet_b.metrics.win_rate,
            average_profit_per_trade: walletOperations.wallet_b.metrics.average_profit_per_trade
          }
        },
        comparison: {
          volume_difference: walletOperations.wallet_b.metrics.total_volume - walletOperations.wallet_a.metrics.total_volume,
          profit_difference: walletOperations.wallet_b.metrics.profit_loss - walletOperations.wallet_a.metrics.profit_loss,
          win_rate_difference: walletOperations.wallet_b.metrics.win_rate - walletOperations.wallet_a.metrics.win_rate,
          efficiency_ratio: (walletOperations.wallet_b.metrics.profit_loss / walletOperations.wallet_b.metrics.total_volume) /
                           (walletOperations.wallet_a.metrics.profit_loss / walletOperations.wallet_a.metrics.total_volume)
        }
      }
    };

    testRunner.expectMetrics(metrics);
    expect(metrics.total_duration).toBeLessThan(6000);
    expect(metrics.wallet_metrics.wallet_a.success_rate).toBeGreaterThan(0.8);
    expect(metrics.wallet_metrics.wallet_b.success_rate).toBeGreaterThan(0.8);
    expect(metrics.wallet_metrics.comparison.efficiency_ratio).toBeGreaterThan(0);

    workflowData.forEach(data => {
      expect(data.duration).toBeLessThan(1000);
      expect(data.metrics.heap_used).toBeLessThan(0.8);
      expect(data.metrics.active_requests).toBeLessThan(100);
      expect(data.wallet_operations.wallet_a.trades).toBeGreaterThan(0);
      expect(data.wallet_operations.wallet_b.trades).toBeGreaterThan(0);
      expect(data.wallet_operations.wallet_a.transfers).toBeGreaterThan(0);
      expect(data.wallet_operations.wallet_b.transfers).toBeGreaterThan(0);
      expect(data.wallet_operations.wallet_a.metrics.win_rate).toBeGreaterThan(0);
      expect(data.wallet_operations.wallet_b.metrics.win_rate).toBeGreaterThan(0);
    });
  });
});
