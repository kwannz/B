'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createWallet, createBot, getBotStatus, updateBotStatus, transferSOL } from '@/app/api/client';
import { useDebugStore } from '@/app/stores/debugStore';
import { TestMetrics } from '../types/test.types';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');
jest.mock('@/app/stores/debugStore');

describe('End-to-End Trading Workflow', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: true,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' },
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
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

  const mockWalletData = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    balance: 1.5,
    bot_id: 'bot-123',
    performance: {
      total_trades: 50,
      success_rate: 0.8,
      profit_loss: 0.5,
      avg_trade_duration: 120,
      max_drawdown: 0.1
    }
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
    (createBot as jest.Mock).mockResolvedValue(mockBot);
    (getBotStatus as jest.Mock).mockResolvedValue(mockBot);
    (createWallet as jest.Mock).mockResolvedValue(mockWalletData);
    (updateBotStatus as jest.Mock).mockResolvedValue({ ...mockBot, status: 'active' });
    (transferSOL as jest.Mock).mockResolvedValue({ success: true });
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

  it('should complete full trading workflow with metrics tracking', async () => {
    // Step 1: Agent Selection
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const tradingAgentButton = screen.getByRole('button', { name: /trading agent/i });
    fireEvent.click(tradingAgentButton);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation');
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0);
    });

    // Step 2: Strategy Creation
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
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveLatency(1000);
    });

    // Step 3: Bot Integration
    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/bot status/i)).toBeInTheDocument();
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });

    // Step 4: Key Management
    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/wallet address/i)).toBeInTheDocument();
      expect(screen.getByText(/5KKs.*fKK/)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveWalletBalance(1.5);
    });

    // Step 5: Trading Dashboard
    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/performance/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveTradeCount(50);
      expect(metrics).toHaveSuccessRate(0.8);
    });

    // Step 6: Wallet Comparison
    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/wallet comparison/i)).toBeInTheDocument();
      expect(screen.getByText(/success rate/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
    });
  });

  it('should handle errors throughout workflow with metrics tracking', async () => {
    const error = new Error('API Error');
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

  it('should validate minimum balance requirements', async () => {
    const lowBalanceWallet = { ...mockWalletData, balance: 0.1 };
    (createWallet as jest.Mock).mockResolvedValueOnce(lowBalanceWallet);

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
      expect(screen.getByText(/minimum 0.5 SOL required/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0.2);
      expect(metrics.performance.systemHealth).toBeLessThan(0.9);
    });
  });

  it('should track performance metrics throughout workflow', async () => {
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
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics).toHaveErrorRate(0);
      expect(metrics).toHaveLatency(1000);
      expect(metrics.performance.systemHealth).toBeGreaterThan(0.9);
      expect(metrics.trading.totalVolume).toBe(1500);
      expect(metrics.trading.profitLoss).toBe(0.75);
    });
  });
});
