import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import TradingDashboard from '../../../src/app/trading-dashboard/page';
import { getBotStatus, updateBotStatus, getWallet } from '../../../src/app/api/client';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn()
}));

// Mock wallet adapter
jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: jest.fn()
}));

// Mock API client
jest.mock('../../../src/app/api/client', () => ({
  getBotStatus: jest.fn(),
  updateBotStatus: jest.fn(),
  getWallet: jest.fn()
}));

describe('TradingDashboard', () => {
  const mockRouter = {
    push: jest.fn()
  };

  const mockSearchParams = {
    get: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    (useWallet as jest.Mock).mockReturnValue({ connected: true });
  });

  it('redirects to agent selection if botId is missing', () => {
    mockSearchParams.get.mockReturnValue(null);
    render(<TradingDashboard />);
    expect(mockRouter.push).toHaveBeenCalledWith('/agent-selection');
  });

  it('redirects to agent selection if wallet is not connected', () => {
    (useWallet as jest.Mock).mockReturnValue({ connected: false });
    mockSearchParams.get.mockReturnValue('test-bot-id');
    render(<TradingDashboard />);
    expect(mockRouter.push).toHaveBeenCalledWith('/agent-selection');
  });

  it('shows wallet connect message when not connected', () => {
    (useWallet as jest.Mock).mockReturnValue({ connected: false });
    render(<TradingDashboard />);
    expect(screen.getByText('Please connect your wallet to view the trading dashboard')).toBeInTheDocument();
  });

  it('loads and displays bot status correctly', async () => {
    mockSearchParams.get.mockReturnValue('test-bot-id');
    (getBotStatus as jest.Mock).mockResolvedValue({
      status: 'active',
      trades: []
    });
    (getWallet as jest.Mock).mockResolvedValue({
      balance: 1.5
    });

    render(<TradingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('1.5000')).toBeInTheDocument();
    });
  });

  it('handles bot status toggle correctly', async () => {
    mockSearchParams.get.mockReturnValue('test-bot-id');
    (getBotStatus as jest.Mock).mockResolvedValue({
      status: 'inactive',
      trades: []
    });
    (getWallet as jest.Mock).mockResolvedValue({
      balance: 1.5
    });
    (updateBotStatus as jest.Mock).mockResolvedValue({
      status: 'active'
    });

    render(<TradingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Start Bot')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Bot'));

    await waitFor(() => {
      expect(updateBotStatus).toHaveBeenCalledWith('test-bot-id', 'active');
    });
  });

  it('displays trading history correctly', async () => {
    mockSearchParams.get.mockReturnValue('test-bot-id');
    const mockTrades = [
      {
        id: '1',
        symbol: 'SOL/USDT',
        side: 'BUY',
        amount: '1.5',
        price: '100',
        status: 'completed',
        timestamp: new Date().toISOString()
      }
    ];

    (getBotStatus as jest.Mock).mockResolvedValue({
      status: 'active',
      trades: mockTrades
    });
    (getWallet as jest.Mock).mockResolvedValue({
      balance: 1.5
    });

    render(<TradingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Trading History')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument(); // Success rate
      expect(screen.getByText('1')).toBeInTheDocument(); // Total trades
    });
  });

  it('handles error states correctly', async () => {
    mockSearchParams.get.mockReturnValue('test-bot-id');
    (getBotStatus as jest.Mock).mockRejectedValue(new Error('API Error'));
    (getWallet as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<TradingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard data. Please try again.')).toBeInTheDocument();
    });
  });

  it('navigates to DEX swap page correctly', async () => {
    mockSearchParams.get.mockReturnValue('test-bot-id');
    (getBotStatus as jest.Mock).mockResolvedValue({
      status: 'active',
      trades: []
    });
    (getWallet as jest.Mock).mockResolvedValue({
      balance: 1.5
    });

    render(<TradingDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('DEX Swap'));
      expect(mockRouter.push).toHaveBeenCalledWith('/dex-swap');
    });
  });

  it('navigates to meme coin page correctly', async () => {
    mockSearchParams.get.mockReturnValue('test-bot-id');
    (getBotStatus as jest.Mock).mockResolvedValue({
      status: 'active',
      trades: []
    });
    (getWallet as jest.Mock).mockResolvedValue({
      balance: 1.5
    });

    render(<TradingDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Meme Coin'));
      expect(mockRouter.push).toHaveBeenCalledWith('/meme-coin');
    });
  });

  it('displays loading state correctly', () => {
    mockSearchParams.get.mockReturnValue('test-bot-id');
    (getBotStatus as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves
    (getWallet as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<TradingDashboard />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('updates bot status with loading state', async () => {
    mockSearchParams.get.mockReturnValue('test-bot-id');
    (getBotStatus as jest.Mock).mockResolvedValue({
      status: 'inactive',
      trades: []
    });
    (getWallet as jest.Mock).mockResolvedValue({
      balance: 1.5
    });
    (updateBotStatus as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<TradingDashboard />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Start Bot'));
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
}); 