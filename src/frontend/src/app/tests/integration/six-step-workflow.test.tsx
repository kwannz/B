import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus, createWallet, getWallet } from '@/app/api/client';
import AgentSelection from '@/app/agent-selection/page';
import StrategyCreation from '@/app/strategy-creation/page';
import BotIntegration from '@/app/bot-integration/page';
import KeyManagement from '@/app/key-management/page';
import TradingDashboard from '@/app/trading-dashboard/page';
import WalletComparison from '@/app/wallet-comparison/page';
import { testRunner } from '../setup/test-runner';

jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('Six-Step Workflow Navigation', () => {
  const mockWallet = {
    address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
    private_key: 'mock_private_key',
    balance: 1.5,
    transactions: [
      { type: 'trade', amount: 0.1, timestamp: Date.now() }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123' });
    (getBotStatus as jest.Mock).mockResolvedValue({ id: 'bot-123', status: 'active' });
    (createWallet as jest.Mock).mockResolvedValue(mockWallet);
    (getWallet as jest.Mock).mockResolvedValue(mockWallet);
  });

  it('should validate complete 6-step workflow navigation', async () => {
    await testRunner.runTest(async () => {
      const workflow = [
        { component: <AgentSelection />, testId: 'agent-selection' },
        { component: <StrategyCreation />, testId: 'strategy-creation' },
        { component: <BotIntegration />, testId: 'bot-integration' },
        { component: <KeyManagement />, testId: 'key-management' },
        { component: <TradingDashboard />, testId: 'trading-dashboard' },
        { component: <WalletComparison />, testId: 'wallet-comparison' }
      ];

      for (const { component, testId } of workflow) {
        render(<TestContext>{component}</TestContext>);
        await waitFor(() => {
          expect(screen.getByTestId(testId)).toBeInTheDocument();
        });
      }

      expect(createBot).toHaveBeenCalled();
      expect(getBotStatus).toHaveBeenCalled();
      expect(createWallet).toHaveBeenCalled();
      expect(getWallet).toHaveBeenCalled();
    });
  });

  it('should validate data persistence across workflow steps', async () => {
    await testRunner.runTest(async () => {
      const botData = { id: 'bot-123', type: 'trading', strategy: 'momentum' };
      (createBot as jest.Mock).mockResolvedValue(botData);

      render(<TestContext><AgentSelection /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('agent-selection')).toBeInTheDocument();
      });

      render(<TestContext><StrategyCreation /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('strategy-creation')).toBeInTheDocument();
      });

      expect(createBot).toHaveBeenCalledWith(botData.type, botData.strategy);

      render(<TestContext><BotIntegration /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('bot-integration')).toBeInTheDocument();
      });

      expect(getBotStatus).toHaveBeenCalledWith(botData.id);

      render(<TestContext><KeyManagement /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('key-management')).toBeInTheDocument();
      });

      expect(createWallet).toHaveBeenCalledWith(botData.id);

      render(<TestContext><TradingDashboard /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('trading-dashboard')).toBeInTheDocument();
      });

      expect(getWallet).toHaveBeenCalledWith(botData.id);

      render(<TestContext><WalletComparison /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('wallet-comparison')).toBeInTheDocument();
      });
    });
  });

  it('should validate real-time updates in trading dashboard', async () => {
    await testRunner.runTest(async () => {
      const updates = [
        { status: 'active', balance: 1.5 },
        { status: 'active', balance: 1.6 },
        { status: 'active', balance: 1.7 }
      ];

      let updateIndex = 0;
      (getBotStatus as jest.Mock).mockImplementation(() => 
        Promise.resolve({ 
          id: 'bot-123', 
          status: updates[updateIndex].status,
          wallet: { ...mockWallet, balance: updates[updateIndex].balance }
        })
      );

      render(<TestContext><TradingDashboard /></TestContext>);

      for (const update of updates) {
        await waitFor(() => {
          const balance = screen.getByTestId('wallet-balance');
          expect(balance).toHaveTextContent(update.balance.toString());
          updateIndex++;
        });
      }
    });
  });

  it('should validate wallet creation and key management', async () => {
    await testRunner.runTest(async () => {
      render(<TestContext><KeyManagement /></TestContext>);

      await waitFor(() => {
        expect(screen.getByTestId('wallet-address')).toHaveTextContent(mockWallet.address);
        expect(screen.getByTestId('private-key')).toHaveTextContent(mockWallet.private_key);
      });

      expect(createWallet).toHaveBeenCalled();
      expect(screen.getByTestId('key-management')).toBeInTheDocument();
    });
  });

  it('should validate strategy creation and bot integration', async () => {
    await testRunner.runTest(async () => {
      const strategy = { type: 'momentum', params: { threshold: 0.5 } };
      (createBot as jest.Mock).mockResolvedValue({ id: 'bot-123', ...strategy });

      render(<TestContext><StrategyCreation /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('strategy-creation')).toBeInTheDocument();
      });

      render(<TestContext><BotIntegration /></TestContext>);
      await waitFor(() => {
        expect(screen.getByTestId('bot-integration')).toBeInTheDocument();
      });

      expect(createBot).toHaveBeenCalledWith(strategy.type, expect.any(String));
      expect(getBotStatus).toHaveBeenCalledWith('bot-123');
    });
  });
});
