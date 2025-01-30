import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import StrategyCreation from '@/app/strategy-creation/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');

describe('StrategyCreation Page', () => {
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

  it('should render strategy creation form', async () => {
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    expect(screen.getByText(/Create Trading Strategy/i)).toBeInTheDocument();
    expect(screen.getByTestId('strategy-form')).toBeInTheDocument();
  });

  it('should validate required strategy parameters', async () => {
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const submitButton = screen.getByRole('button', { name: /Create Strategy/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Strategy name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Time frame is required/i)).toBeInTheDocument();
    });
  });

  it('should navigate to bot integration on successful strategy creation', async () => {
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const nameInput = screen.getByTestId('strategy-name');
    const timeframeSelect = screen.getByTestId('timeframe-select');
    const thresholdInput = screen.getByTestId('threshold-input');

    fireEvent.change(nameInput, { target: { value: 'Momentum Strategy' } });
    fireEvent.change(timeframeSelect, { target: { value: '1h' } });
    fireEvent.change(thresholdInput, { target: { value: '0.05' } });

    const submitButton = screen.getByRole('button', { name: /Create Strategy/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/bot-integration');
    });
  });

  it('should display strategy performance metrics', async () => {
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const performanceMetrics = screen.getAllByTestId('performance-metric');
    expect(performanceMetrics.length).toBeGreaterThan(0);

    performanceMetrics.forEach(metric => {
      expect(metric).toHaveAttribute('data-metric-name');
      expect(metric).toHaveTextContent(/[0-9]/);
    });
  });

  it('should handle strategy validation errors', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const nameInput = screen.getByTestId('strategy-name');
    fireEvent.change(nameInput, { target: { value: 'Invalid Strategy' } });

    const submitButton = screen.getByRole('button', { name: /Create Strategy/i });
    fireEvent.click(submitButton);

    expect(screen.getByText(/Strategy validation failed/i)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('should persist strategy parameters in state', async () => {
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const nameInput = screen.getByTestId('strategy-name');
    const timeframeSelect = screen.getByTestId('timeframe-select');
    const thresholdInput = screen.getByTestId('threshold-input');

    fireEvent.change(nameInput, { target: { value: 'Test Strategy' } });
    fireEvent.change(timeframeSelect, { target: { value: '4h' } });
    fireEvent.change(thresholdInput, { target: { value: '0.1' } });

    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    expect(screen.getByTestId('strategy-name')).toHaveValue('Test Strategy');
    expect(screen.getByTestId('timeframe-select')).toHaveValue('4h');
    expect(screen.getByTestId('threshold-input')).toHaveValue('0.1');
  });

  it('should update strategy parameters based on market conditions', async () => {
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const marketConditionSelect = screen.getByTestId('market-condition');
    fireEvent.change(marketConditionSelect, { target: { value: 'volatile' } });

    await waitFor(() => {
      const thresholdInput = screen.getByTestId('threshold-input');
      expect(thresholdInput).toHaveValue('0.08');
    });
  });

  it('should validate strategy risk parameters', async () => {
    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const stopLossInput = screen.getByTestId('stop-loss');
    const takeProfitInput = screen.getByTestId('take-profit');

    fireEvent.change(stopLossInput, { target: { value: '-0.15' } });
    fireEvent.change(takeProfitInput, { target: { value: '0.1' } });

    const submitButton = screen.getByRole('button', { name: /Create Strategy/i });
    fireEvent.click(submitButton);

    expect(screen.getByText(/Stop loss must be greater than -10%/i)).toBeInTheDocument();
  });

  it('should track strategy creation metrics', async () => {
    const mockMetrics = {
      creations: [] as { strategy: string; timestamp: number }[],
      validations: [] as { result: boolean; timestamp: number }[]
    };

    render(
      <TestContext>
        <StrategyCreation />
      </TestContext>
    );

    const nameInput = screen.getByTestId('strategy-name');
    const timeframeSelect = screen.getByTestId('timeframe-select');
    const submitButton = screen.getByRole('button', { name: /Create Strategy/i });

    fireEvent.change(nameInput, { target: { value: 'Test Strategy' } });
    fireEvent.change(timeframeSelect, { target: { value: '1h' } });
    fireEvent.click(submitButton);

    expect(mockMetrics.creations).toContainEqual({
      strategy: 'Test Strategy',
      timestamp: expect.any(Number)
    });

    expect(mockMetrics.validations).toContainEqual({
      result: true,
      timestamp: expect.any(Number)
    });
  });
});
