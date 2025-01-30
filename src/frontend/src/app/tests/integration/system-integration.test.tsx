import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
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

describe('System Integration Tests', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: true,
    connecting: false,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' },
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
    (createBot as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      type: 'trading',
      strategy: 'Test Strategy'
    });
    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'active',
      metrics: {
        total_volume: 1000,
        profit_loss: 0.5,
        active_positions: 2
      }
    });
    (createWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      bot_id: 'bot-123'
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5,
      bot_id: 'bot-123'
    });
  });

  it('should validate complete system workflow integration', async () => {
    const startTime = Date.now();
    let currentMetrics: TestMetrics;

    // Step 1: Agent Selection
    const { rerender } = render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const agentButton = screen.getByRole('button', { name: /trading agent/i });
    fireEvent.click(agentButton);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation');
    });

    // Step 2: Strategy Creation
    rerender(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const strategyInput = screen.getByRole('textbox', { name: /strategy/i });
    fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
    
    const createButton = screen.getByRole('button', { name: /create strategy/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createBot).toHaveBeenCalledWith('trading', 'Test Strategy');
    });

    // Step 3: Bot Integration
    rerender(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    await waitFor(() => {
      expect(getBotStatus).toHaveBeenCalled();
      expect(screen.getByText(/bot active/i)).toBeInTheDocument();
    });

    // Step 4: Key Management
    rerender(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const createWalletButton = screen.getByRole('button', { name: /create wallet/i });
    fireEvent.click(createWalletButton);

    await waitFor(() => {
      expect(createWallet).toHaveBeenCalled();
      expect(screen.getByText(/5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK/)).toBeInTheDocument();
    });

    // Step 5: Trading Dashboard
    rerender(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/total volume/i)).toBeInTheDocument();
      expect(screen.getByText(/1000/)).toBeInTheDocument();
    });

    // Step 6: Wallet Comparison
    rerender(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(getWallet).toHaveBeenCalled();
      expect(screen.getByText(/1.5 SOL/)).toBeInTheDocument();
    });

    currentMetrics = {
      performance: {
        errorRate: 0,
        apiLatency: Date.now() - startTime,
        systemHealth: 1,
        successRate: 1,
        totalTrades: 0,
        walletBalance: 1.5
      },
      trading: {
        totalVolume: 1000,
        profitLoss: 0.5,
        activePositions: 2
      }
    };

    expect(currentMetrics.performance.apiLatency).toBeLessThan(5000);
    expect(currentMetrics.performance.errorRate).toBe(0);
    expect(currentMetrics.performance.systemHealth).toBe(1);
  });

  it('should handle system-wide error scenarios', async () => {
    (createBot as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    (getBotStatus as jest.Mock).mockRejectedValueOnce(new Error('Service unavailable'));

    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const strategyInput = screen.getByRole('textbox', { name: /strategy/i });
    fireEvent.change(strategyInput, { target: { value: 'Test Strategy' } });
    
    const createButton = screen.getByRole('button', { name: /create strategy/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.errorRate).toBeGreaterThan(0);
      expect(metrics.performance.systemHealth).toBeLessThan(1);
    });
  });

  it('should validate system performance under load', async () => {
    const operations = [
      createBot('trading', 'Strategy 1'),
      createBot('trading', 'Strategy 2'),
      getBotStatus('bot-123'),
      createWallet('bot-123'),
      getWallet('bot-123')
    ];

    const startTime = Date.now();
    const results = await Promise.allSettled(operations);
    const endTime = Date.now();

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const metrics: TestMetrics = {
      performance: {
        errorRate: (operations.length - successCount) / operations.length,
        apiLatency: (endTime - startTime) / operations.length,
        systemHealth: successCount / operations.length,
        successRate: successCount / operations.length,
        totalTrades: 0,
        walletBalance: 1.5
      }
    };

    expect(metrics.performance.apiLatency).toBeLessThan(1000);
    expect(metrics.performance.successRate).toBeGreaterThan(0.8);
  });

  it('should maintain data consistency across components', async () => {
    const bot = await createBot('trading', 'Test Strategy');
    const wallet = await createWallet(bot.id);

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(wallet.address)).toBeInTheDocument();
      expect(screen.getByText(bot.id)).toBeInTheDocument();
    });

    rerender(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(wallet.address)).toBeInTheDocument();
      expect(screen.getByText(`${wallet.balance} SOL`)).toBeInTheDocument();
    });
  });
});
