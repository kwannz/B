import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { getBotStatus, getWallet } from '@/app/api/client';
import TradingDashboard from '@/app/trading-dashboard/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('TradingDashboard Page', () => {
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
  });

  it('should render trading dashboard with bot status', async () => {
    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'active',
      metrics: {
        trades: 10,
        success_rate: 0.8,
        profit_loss: 0.15
      }
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/Trading Dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/Bot Status: active/i)).toBeInTheDocument();
      expect(screen.getByTestId('success-rate')).toHaveTextContent('80%');
    });
  });

  it('should update bot metrics in real-time', async () => {
    jest.useFakeTimers();

    const mockMetrics = [
      { trades: 10, success_rate: 0.8, profit_loss: 0.15 },
      { trades: 11, success_rate: 0.82, profit_loss: 0.16 }
    ];

    (getBotStatus as jest.Mock)
      .mockResolvedValueOnce({
        id: 'bot-123',
        status: 'active',
        metrics: mockMetrics[0]
      })
      .mockResolvedValueOnce({
        id: 'bot-123',
        status: 'active',
        metrics: mockMetrics[1]
      });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-trades')).toHaveTextContent('10');
    });

    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(screen.getByTestId('total-trades')).toHaveTextContent('11');
      expect(screen.getByTestId('success-rate')).toHaveTextContent('82%');
    });

    jest.useRealTimers();
  });

  it('should display wallet balance and transactions', async () => {
    (getWallet as jest.Mock).mockResolvedValue({
      address: '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK',
      balance: 2.5,
      transactions: [
        { type: 'trade', amount: 0.1, timestamp: Date.now() }
      ]
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByTestId('wallet-balance')).toHaveTextContent('2.5 SOL');
      expect(screen.getByTestId('transaction-history')).toBeInTheDocument();
    });
  });

  it('should handle bot status update errors', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getBotStatus as jest.Mock).mockRejectedValue(new Error('Failed to fetch bot status'));

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error updating bot status/i)).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should allow manual bot control', async () => {
    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'active',
      metrics: {
        trades: 10,
        success_rate: 0.8,
        profit_loss: 0.15
      }
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    const stopButton = screen.getByRole('button', { name: /Stop Bot/i });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText(/Bot Status: inactive/i)).toBeInTheDocument();
    });
  });

  it('should track trading performance metrics', async () => {
    const mockMetrics = {
      trades: [] as { timestamp: number; type: string; result: string }[],
      performance: [] as { metric: string; value: number }[]
    };

    (getBotStatus as jest.Mock).mockImplementation(() => {
      const trade = {
        timestamp: Date.now(),
        type: 'market',
        result: 'success'
      };
      mockMetrics.trades.push(trade);

      const performance = {
        success_rate: mockMetrics.trades.filter(t => t.result === 'success').length / mockMetrics.trades.length,
        profit_loss: Math.random() * 0.2
      };
      mockMetrics.performance.push({
        metric: 'success_rate',
        value: performance.success_rate
      });

      return Promise.resolve({
        id: 'bot-123',
        status: 'active',
        metrics: performance
      });
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      const performanceMetrics = screen.getAllByTestId('performance-metric');
      performanceMetrics.forEach(metric => {
        expect(metric).toHaveAttribute('data-metric-name');
        expect(metric).toHaveTextContent(/[0-9]/);
      });
    });
  });

  it('should validate trading limits and risk parameters', async () => {
    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    const riskLimitInput = screen.getByTestId('risk-limit');
    fireEvent.change(riskLimitInput, { target: { value: '0.5' } });

    expect(screen.getByText(/Risk limit updated/i)).toBeInTheDocument();
  });

  it('should display real-time market data', async () => {
    jest.useFakeTimers();

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    const marketData = screen.getByTestId('market-data');
    const initialPrice = marketData.textContent;

    jest.advanceTimersByTime(5000);

    expect(marketData.textContent).not.toBe(initialPrice);

    jest.useRealTimers();
  });

  it('should handle websocket connection errors', async () => {
    const mockWebSocket = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn()
    };

    (window as any).WebSocket = jest.fn(() => {
      throw new Error('WebSocket connection failed');
    });

    render(
      <TestContext>
        <TradingDashboard />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/WebSocket connection error/i)).toBeInTheDocument();
    });
  });
});
