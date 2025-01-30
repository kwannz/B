import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createWallet, getWallet } from '@/app/api/client';
import KeyManagement from '@/app/key-management/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('KeyManagement Page', () => {
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

  it('should render key management form', async () => {
    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    expect(screen.getByText(/Key Management/i)).toBeInTheDocument();
    expect(screen.getByTestId('key-form')).toBeInTheDocument();
  });

  it('should create wallet and navigate to trading dashboard', async () => {
    (createWallet as jest.Mock).mockResolvedValue({
      address: '7MmPwD5TQzXBtKnLGNEHzLHuPsE8kw9aNgvhYxM3yxVJ',
      status: 'active'
    });

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const createButton = screen.getByRole('button', { name: /Create Wallet/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createWallet).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith('/trading-dashboard');
    });
  });

  it('should display wallet creation error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (createWallet as jest.Mock).mockRejectedValue(new Error('Wallet creation failed'));

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const createButton = screen.getByRole('button', { name: /Create Wallet/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Wallet creation failed/i)).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should validate wallet configuration', async () => {
    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const createButton = screen.getByRole('button', { name: /Create Wallet/i });
    fireEvent.click(createButton);

    expect(screen.getByText(/Please configure wallet settings/i)).toBeInTheDocument();
  });

  it('should update wallet status after creation', async () => {
    (createWallet as jest.Mock).mockResolvedValue({
      address: '7MmPwD5TQzXBtKnLGNEHzLHuPsE8kw9aNgvhYxM3yxVJ',
      status: 'created'
    });

    (getWallet as jest.Mock).mockResolvedValue({
      address: '7MmPwD5TQzXBtKnLGNEHzLHuPsE8kw9aNgvhYxM3yxVJ',
      status: 'active'
    });

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const createButton = screen.getByRole('button', { name: /Create Wallet/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(getWallet).toHaveBeenCalled();
      expect(screen.getByText(/Wallet Status: active/i)).toBeInTheDocument();
    });
  });

  it('should persist wallet configuration in state', async () => {
    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const nameInput = screen.getByTestId('wallet-name');
    const typeSelect = screen.getByTestId('wallet-type');

    fireEvent.change(nameInput, { target: { value: 'Test Wallet' } });
    fireEvent.change(typeSelect, { target: { value: 'trading' } });

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    expect(screen.getByTestId('wallet-name')).toHaveValue('Test Wallet');
    expect(screen.getByTestId('wallet-type')).toHaveValue('trading');
  });

  it('should track wallet creation metrics', async () => {
    const mockMetrics = {
      creations: [] as { wallet: string; timestamp: number }[],
      validations: [] as { result: boolean; timestamp: number }[]
    };

    (createWallet as jest.Mock).mockImplementation((name, type) => {
      mockMetrics.creations.push({
        wallet: name,
        timestamp: Date.now()
      });
      return Promise.resolve({
        address: '7MmPwD5TQzXBtKnLGNEHzLHuPsE8kw9aNgvhYxM3yxVJ',
        status: 'created'
      });
    });

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const nameInput = screen.getByTestId('wallet-name');
    const typeSelect = screen.getByTestId('wallet-type');
    const createButton = screen.getByRole('button', { name: /Create Wallet/i });

    fireEvent.change(nameInput, { target: { value: 'Test Wallet' } });
    fireEvent.change(typeSelect, { target: { value: 'trading' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockMetrics.creations).toContainEqual({
        wallet: 'Test Wallet',
        timestamp: expect.any(Number)
      });
    });
  });

  it('should validate wallet type compatibility', async () => {
    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    const typeSelect = screen.getByTestId('wallet-type');
    fireEvent.change(typeSelect, { target: { value: 'unsupported' } });

    expect(screen.getByText(/Wallet type not supported/i)).toBeInTheDocument();
  });

  it('should handle concurrent wallet creation requests', async () => {
    const mockRequests = Array.from({ length: 3 }, (_, i) => ({
      name: `Wallet ${i + 1}`,
      type: 'trading'
    }));

    const createPromises = mockRequests.map(req =>
      createWallet(req.name, req.type).then(res => ({
        request: req,
        response: res
      }))
    );

    render(
      <TestContext>
        <KeyManagement />
      </TestContext>
    );

    await Promise.all(createPromises);

    expect(createWallet).toHaveBeenCalledTimes(mockRequests.length);
  });
});
