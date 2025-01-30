'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, updateBotStatus } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';

jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('Strategy Creation and Bot Integration', () => {
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

  it('should create a trading strategy and configure bot successfully', async () => {
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

  it('should validate strategy parameters before creation', async () => {
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/strategy required/i)).toBeInTheDocument();
      expect(createBot).not.toHaveBeenCalled();
    });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0.2);
    expect(metrics.performance.systemHealth).toBeLessThan(0.9);
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

  it('should integrate bot with strategy parameters', async () => {
    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/test strategy/i)).toBeInTheDocument();
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
  });

  it('should update bot configuration with metrics tracking', async () => {
    const updatedBot = {
      ...mockBot,
      strategy: 'Updated Strategy',
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
        <BotIntegration />
      </TestContext>
    );

    const updateButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(screen.getByText(/updated strategy/i)).toBeInTheDocument();
      expect(screen.getByText(/0.75/)).toBeInTheDocument();
    });

    const metrics = useDebugStore.getState().metrics as TestMetrics;
    expect(metrics).toHaveErrorRate(0);
    expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
  });

  it('should validate bot performance metrics', async () => {
    const underperformingBot = {
      ...mockBot,
      metrics: {
        total_volume: 500,
        profit_loss: -0.2,
        active_positions: 1,
        error_rate: 0.3
      }
    };

    (getBotStatus as jest.Mock).mockResolvedValueOnce(underperformingBot);

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/performance warning/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0.3);
      expect(metrics.performance.systemHealth).toBeLessThan(0.8);
    });
  });
});
