'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createWallet, createBot, getBotStatus, updateBotStatus } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Trading Workflow Integration', () => {
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

  const mockBotResponse = {
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

  const mockWalletResponse = {
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
    (createBot as jest.Mock).mockResolvedValue(mockBotResponse);
    (createWallet as jest.Mock).mockResolvedValue(mockWalletResponse);
    (getBotStatus as jest.Mock).mockResolvedValue({ ...mockBotResponse, status: 'active' });
    (updateBotStatus as jest.Mock).mockResolvedValue({ ...mockBotResponse, status: 'active' });
  });

  it('should complete the full trading workflow successfully', async () => {
    // Step 1: Agent Selection
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const tradingAgentButton = screen.getByRole('button', { name: /trading agent/i });
    fireEvent.click(tradingAgentButton);
    expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation');

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
    });

    const continueButton = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueButton);
    expect(mockRouter.push).toHaveBeenCalledWith('/key-management');

    // Step 4: Key Management
    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/wallet address/i)).toBeInTheDocument();
      expect(screen.getByText(/5KKs.*fKK/)).toBeInTheDocument();
      expect(screen.getByText(/1.5 SOL/)).toBeInTheDocument();
    });

    const proceedButton = screen.getByRole('button', { name: /proceed/i });
    fireEvent.click(proceedButton);
    expect(mockRouter.push).toHaveBeenCalledWith('/trading-dashboard');

    // Step 5: Trading Dashboard
    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/performance/i)).toBeInTheDocument();
      expect(screen.getByText(/profit/i)).toBeInTheDocument();
      expect(screen.getByText(/0.5 SOL/)).toBeInTheDocument();
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
      expect(screen.getByText(/80%/)).toBeInTheDocument();
      expect(screen.getByText(/50 trades/)).toBeInTheDocument();
    });
  });

  it('should handle errors gracefully throughout the workflow', async () => {
    (createBot as jest.Mock).mockRejectedValueOnce(new Error('Failed to create bot'));

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
    });
  });

  it('should validate wallet balance requirements', async () => {
    const lowBalanceWallet = { ...mockWalletResponse, balance: 0.1 };
    (createWallet as jest.Mock).mockResolvedValueOnce(lowBalanceWallet);

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

  it('should track and display performance metrics correctly', async () => {
    const updatedMetrics = {
      ...mockBotResponse.metrics,
      profit_loss: 0.75,
      total_volume: 1500
    };

    (getBotStatus as jest.Mock)
      .mockResolvedValueOnce({ ...mockBotResponse, metrics: mockBotResponse.metrics })
      .mockResolvedValueOnce({ ...mockBotResponse, metrics: updatedMetrics });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/0.5 SOL/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/0.75 SOL/)).toBeInTheDocument();
      expect(screen.getByText(/1500/)).toBeInTheDocument();
    });
  });
});
