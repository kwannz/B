import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { getWallet } from '@/app/api/client';
import WalletComparison from '@/app/wallet-comparison/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('WalletComparison Page', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn()
  };

  const mockWalletA = {
    connected: true,
    connecting: false,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' },
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  const mockWalletB = {
    connected: true,
    connecting: false,
    publicKey: { toString: () => '7MmPwD5TQzXBtKnLGNEHzLHuPsE8kw9aNgvhYxM3yxVJ' },
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('should render wallet comparison interface', async () => {
    (useWallet as jest.Mock).mockReturnValue(mockWalletA);

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    expect(screen.getByText(/Wallet Comparison/i)).toBeInTheDocument();
    expect(screen.getByTestId('wallet-comparison-form')).toBeInTheDocument();
  });

  it('should display wallet performance metrics', async () => {
    (getWallet as jest.Mock).mockResolvedValue({
      address: mockWalletA.publicKey.toString(),
      performance: {
        trades: 15,
        success_rate: 0.85,
        avg_return: 0.06,
        total_value: 2.5
      }
    });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByTestId('success-rate')).toHaveTextContent('85%');
      expect(screen.getByTestId('avg-return')).toHaveTextContent('6%');
      expect(screen.getByTestId('total-value')).toHaveTextContent('2.5 SOL');
    });
  });

  it('should compare two wallets side by side', async () => {
    (useWallet as jest.Mock)
      .mockReturnValueOnce(mockWalletA)
      .mockReturnValueOnce(mockWalletB);

    (getWallet as jest.Mock)
      .mockResolvedValueOnce({
        address: mockWalletA.publicKey.toString(),
        performance: {
          trades: 15,
          success_rate: 0.85,
          avg_return: 0.06,
          total_value: 2.5
        }
      })
      .mockResolvedValueOnce({
        address: mockWalletB.publicKey.toString(),
        performance: {
          trades: 12,
          success_rate: 0.75,
          avg_return: 0.04,
          total_value: 2.0
        }
      });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('wallet-card')).toHaveLength(2);
    });

    const walletCards = screen.getAllByTestId('wallet-card');
    expect(walletCards[0]).toHaveTextContent('85%');
    expect(walletCards[1]).toHaveTextContent('75%');
  });

  it('should handle wallet data fetch errors', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getWallet as jest.Mock).mockRejectedValue(new Error('Failed to fetch wallet data'));

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error fetching wallet data/i)).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should update comparison metrics in real-time', async () => {
    jest.useFakeTimers();

    const mockPerformanceA = {
      trades: 15,
      success_rate: 0.85,
      avg_return: 0.06,
      total_value: 2.5
    };

    const mockPerformanceB = {
      trades: 12,
      success_rate: 0.75,
      avg_return: 0.04,
      total_value: 2.0
    };

    (getWallet as jest.Mock)
      .mockResolvedValueOnce({
        address: mockWalletA.publicKey.toString(),
        performance: mockPerformanceA
      })
      .mockResolvedValueOnce({
        address: mockWalletB.publicKey.toString(),
        performance: mockPerformanceB
      })
      .mockResolvedValueOnce({
        address: mockWalletA.publicKey.toString(),
        performance: { ...mockPerformanceA, trades: 16, success_rate: 0.86 }
      })
      .mockResolvedValueOnce({
        address: mockWalletB.publicKey.toString(),
        performance: { ...mockPerformanceB, trades: 13, success_rate: 0.76 }
      });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    const initialMetrics = await screen.findAllByTestId('performance-metric');
    const initialValues = initialMetrics.map(metric => metric.textContent);

    jest.advanceTimersByTime(5000);

    const updatedMetrics = await screen.findAllByTestId('performance-metric');
    const updatedValues = updatedMetrics.map(metric => metric.textContent);

    expect(updatedValues).not.toEqual(initialValues);

    jest.useRealTimers();
  });

  it('should calculate and display performance differences', async () => {
    (useWallet as jest.Mock)
      .mockReturnValueOnce(mockWalletA)
      .mockReturnValueOnce(mockWalletB);

    (getWallet as jest.Mock)
      .mockResolvedValueOnce({
        address: mockWalletA.publicKey.toString(),
        performance: {
          trades: 15,
          success_rate: 0.85,
          avg_return: 0.06,
          total_value: 2.5
        }
      })
      .mockResolvedValueOnce({
        address: mockWalletB.publicKey.toString(),
        performance: {
          trades: 12,
          success_rate: 0.75,
          avg_return: 0.04,
          total_value: 2.0
        }
      });

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      const differences = screen.getAllByTestId('performance-difference');
      expect(differences[0]).toHaveTextContent('+10%');
      expect(differences[1]).toHaveTextContent('+2%');
      expect(differences[2]).toHaveTextContent('+0.5 SOL');
    });
  });

  it('should track comparison metrics', async () => {
    const mockMetrics = {
      comparisons: [] as { walletA: string; walletB: string; timestamp: number }[],
      differences: [] as { metric: string; value: number }[]
    };

    render(
      <TestContext>
        <WalletComparison />
      </TestContext>
    );

    await waitFor(() => {
      const performanceMetrics = screen.getAllByTestId('performance-metric');
      performanceMetrics.forEach(metric => {
        const name = metric.getAttribute('data-metric-name');
        const value = parseFloat(metric.textContent);
        expect(mockMetrics.differences).toContainEqual({
          metric: name,
          value
        });
      });
    });
  });
});
