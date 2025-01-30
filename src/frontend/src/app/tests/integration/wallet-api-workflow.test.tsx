'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createWallet, getWallet, createBot, getBotStatus } from '@/app/api/client';
import Home from '@/app/page';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Wallet API Integration Workflow', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWallet = {
    connected: false,
    connecting: false,
    publicKey: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useWallet as jest.Mock).mockReturnValue(mockWallet);
    (createWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      private_key: 'encrypted_private_key'
    });
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 1.5
    });
    (createBot as jest.Mock).mockResolvedValue({
      id: 'bot_123',
      type: 'trading',
      status: 'created'
    });
    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot_123',
      status: 'active',
      performance: {
        total_trades: 10,
        success_rate: 0.8,
        profit_loss: 0.25
      }
    });
  });

  it('should complete the full trading workflow with API interactions', async () => {
    const connectedWallet = {
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    };

    // Step 1: Connect Wallet
    render(
      <TestContext>
        <Home />
      </TestContext>
    );

    (useWallet as jest.Mock).mockReturnValue(connectedWallet);
    const connectButton = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(connectButton);

    // Step 2: Agent Selection
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const tradingAgentButton = screen.getByRole('button', { name: /trading agent/i });
    fireEvent.click(tradingAgentButton);
    expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation');

    // Step 3: Strategy Creation
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

    // Step 4: Bot Integration
    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    await waitFor(() => {
      expect(getBotStatus).toHaveBeenCalledWith('bot_123');
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    // Step 5: Key Management
    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    await waitFor(() => {
      expect(createWallet).toHaveBeenCalledWith('bot_123');
      expect(screen.getByText(/5KKs.*fKK/)).toBeInTheDocument();
      expect(screen.getByText(/1.5 SOL/)).toBeInTheDocument();
    });

    // Step 6: Trading Dashboard
    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/Success Rate: 80%/)).toBeInTheDocument();
      expect(screen.getByText(/Total Trades: 10/)).toBeInTheDocument();
      expect(screen.getByText(/Profit\/Loss: \+0.25 SOL/)).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    (createBot as jest.Mock).mockRejectedValueOnce(new Error('API Error'));
    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    });

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
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('should validate wallet balance before enabling trading', async () => {
    (getWallet as jest.Mock).mockResolvedValueOnce({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 0.1
    });

    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    });

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/0.1 SOL/)).toBeInTheDocument();
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
    });
  });

  it('should update trading metrics in real-time', async () => {
    const mockPerformanceUpdates = [
      { total_trades: 10, success_rate: 0.8, profit_loss: 0.25 },
      { total_trades: 11, success_rate: 0.82, profit_loss: 0.28 },
      { total_trades: 12, success_rate: 0.83, profit_loss: 0.3 }
    ];

    let updateIndex = 0;
    (getBotStatus as jest.Mock).mockImplementation(() => 
      Promise.resolve({
        id: 'bot_123',
        status: 'active',
        performance: mockPerformanceUpdates[updateIndex++ % mockPerformanceUpdates.length]
      })
    );

    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    for (const update of mockPerformanceUpdates) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`Success Rate: ${update.success_rate * 100}%`))).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`Total Trades: ${update.total_trades}`))).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`Profit/Loss: \\+${update.profit_loss} SOL`))).toBeInTheDocument();
      });
    }
  });
});
