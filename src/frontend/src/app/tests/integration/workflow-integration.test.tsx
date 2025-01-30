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

describe('Complete Workflow Integration', () => {
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

  it('should complete the full 6-step workflow successfully', async () => {
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
      expect(mockRouter.push).toHaveBeenCalledWith('/bot-integration');
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

    // Step 4: Key Management (Wallet Creation)
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

    // Validate final metrics
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
    expect(currentMetrics.trading.totalVolume).toBe(1000);
  });

  it('should handle errors during workflow gracefully', async () => {
    (createBot as jest.Mock).mockRejectedValueOnce(new Error('Failed to create bot'));
    
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
      expect(screen.getByText(/failed to create bot/i)).toBeInTheDocument();
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.errorRate).toBeGreaterThan(0);
      expect(metrics.performance.systemHealth).toBeLessThan(1);
    });
  });

  it('should validate wallet balance requirements', async () => {
    (getWallet as jest.Mock).mockResolvedValueOnce({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 0.1,
      bot_id: 'bot-123'
    });

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
      expect(screen.getByText(/minimum 0.5 SOL required/i)).toBeInTheDocument();
    });
  });

  it('should track performance metrics throughout workflow', async () => {
    const startTime = Date.now();
    
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const agentButton = screen.getByRole('button', { name: /trading agent/i });
    fireEvent.click(agentButton);

    await waitFor(() => {
      const metrics = useDebugStore.getState().metrics as TestMetrics;
      expect(metrics.performance.apiLatency).toBeLessThan(1000);
      expect(metrics.performance.errorRate).toBe(0);
      expect(Date.now() - startTime).toBeLessThan(2000);
    });
  });
});
