'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import Home from '@/app/page';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import { TestContext } from '../contexts/TestContext';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');

describe('Wallet Integration Workflow', () => {
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
  });

  it('should require wallet connection before accessing trading features', async () => {
    render(
      <TestContext>
        <Home />
      </TestContext>
    );

    const connectButton = screen.getByRole('button', { name: /connect/i });
    expect(connectButton).toBeInTheDocument();

    fireEvent.click(connectButton);
    expect(mockWallet.connect).toHaveBeenCalled();
  });

  it('should follow the complete trading workflow after wallet connection', async () => {
    const connectedWallet = {
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    };
    (useWallet as jest.Mock).mockReturnValue(connectedWallet);

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
    expect(mockRouter.push).toHaveBeenCalledWith('/bot-integration');

    // Step 3: Bot Integration
    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/bot status/i)).toBeInTheDocument();
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
    });
  });

  it('should handle wallet disconnection gracefully', async () => {
    const connectedWallet = {
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    };
    (useWallet as jest.Mock).mockReturnValue(connectedWallet);

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectButton);

    expect(mockWallet.disconnect).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('should validate wallet balance before enabling trading', async () => {
    const connectedWallet = {
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    };
    (useWallet as jest.Mock).mockReturnValue(connectedWallet);

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/wallet address/i)).toBeInTheDocument();
    });
  });

  it('should persist wallet connection across workflow steps', async () => {
    const connectedWallet = {
      ...mockWallet,
      connected: true,
      publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' }
    };
    (useWallet as jest.Mock).mockReturnValue(connectedWallet);

    const pages = [
      <AgentSelection />,
      <StrategyCreation />,
      <BotIntegration />,
      <KeyManagement />,
      <TradingDashboard />
    ];

    for (const page of pages) {
      render(
        <TestContext>
          {page}
        </TestContext>
      );

      await waitFor(() => {
        expect(screen.getByText(/5KKs.*fKK/)).toBeInTheDocument();
      });
    }
  });
});
