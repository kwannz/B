'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, updateBotStatus } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import BotIntegration from '@/app/bot-integration/page';
import StrategyCreation from '@/app/strategy-creation/page';
import TradingDashboard from '@/app/trading-dashboard/page';

jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Bot Integration Workflow', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockBot = {
    id: 'bot-123',
    type: 'trading',
    strategy: 'Test Strategy',
    status: 'active',
    metrics: {
      total_volume: 1000,
      profit_loss: 0.5,
      active_positions: 2
    }
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);
    (updateBotStatus as jest.Mock).mockResolvedValue({ ...mockBot, status: 'active' });
    (useDebugStore.getState as jest.Mock).mockReturnValue({
      metrics: {
        performance: {
          errorRate: 0,
          apiLatency: 0,
          systemHealth: 1,
          successRate: 1,
          totalTrades: 0,
          walletBalance: 0
        }
      },
      updateMetrics: jest.fn(),
      addLog: jest.fn()
    });
  });

  it('should create and configure a trading bot successfully', async () => {
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const strategyInput = screen.getByLabelText(/strategy/i);
    const createButton = screen.getByRole('button', { name: /create/i });

    fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createBot).toHaveBeenCalledWith('trading', 'Test Strategy');
      expect(mockRouter.push).toHaveBeenCalledWith('/bot-integration');
    });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics).toHaveLatency(1000);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
  });

  it('should handle bot status updates with metrics tracking', async () => {
    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/bot status/i)).toBeInTheDocument();
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: /toggle status/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(updateBotStatus).toHaveBeenCalledWith('bot-123', 'inactive');
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });

  it('should display bot performance metrics correctly', async () => {
    const updatedBot = {
      ...mockBot,
      metrics: {
        total_volume: 1500,
        profit_loss: 0.75,
        active_positions: 3
      }
    };

    (getBotStatus as jest.Mock)
      .mockResolvedValueOnce(mockBot)
      .mockResolvedValueOnce(updatedBot);

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/1000/)).toBeInTheDocument();
      expect(screen.getByText(/0.5/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/1500/)).toBeInTheDocument();
      expect(screen.getByText(/0.75/)).toBeInTheDocument();
      expect(screen.getByText(/3/)).toBeInTheDocument();
    });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
  });

  it('should handle bot creation errors with metrics tracking', async () => {
    const error = new Error('Failed to create bot');
    (createBot as jest.Mock).mockRejectedValueOnce(error);

    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const strategyInput = screen.getByLabelText(/strategy/i);
    const createButton = screen.getByRole('button', { name: /create/i });

    fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/error.*creating bot/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0.2);
      expect(metrics.performance.systemHealth).toBeLessThan(0.9);
    });
  });

  it('should validate bot configuration requirements', async () => {
    const invalidBot = {
      ...mockBot,
      status: 'error',
      metrics: {
        ...mockBot.metrics,
        error_rate: 0.5
      }
    };

    (getBotStatus as jest.Mock).mockResolvedValueOnce(invalidBot);

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/configuration error/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0.2);
      expect(metrics.performance.systemHealth).toBeLessThan(0.9);
    });
  });

  it('should track real-time bot performance updates', async () => {
    const performanceUpdates = [
      { ...mockBot, metrics: { total_volume: 1000, profit_loss: 0.5, active_positions: 2 } },
      { ...mockBot, metrics: { total_volume: 1200, profit_loss: 0.6, active_positions: 3 } },
      { ...mockBot, metrics: { total_volume: 1500, profit_loss: 0.75, active_positions: 4 } }
    ];

    (getBotStatus as jest.Mock)
      .mockResolvedValueOnce(performanceUpdates[0])
      .mockResolvedValueOnce(performanceUpdates[1])
      .mockResolvedValueOnce(performanceUpdates[2]);

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    for (const update of performanceUpdates) {
      await waitFor(() => {
        expect(screen.getByText(update.metrics.total_volume.toString())).toBeInTheDocument();
        expect(screen.getByText(update.metrics.profit_loss.toString())).toBeInTheDocument();
        expect(screen.getByText(update.metrics.active_positions.toString())).toBeInTheDocument();
      });
    }

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
  });
});
