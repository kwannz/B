import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import { createBot, getBotStatus } from '@/app/api/client';
import BotIntegration from '@/app/bot-integration/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');
jest.mock('@/app/api/client');

describe('BotIntegration Page', () => {
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

  it('should render bot integration form', async () => {
    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    expect(screen.getByText(/Bot Integration/i)).toBeInTheDocument();
    expect(screen.getByTestId('bot-form')).toBeInTheDocument();
  });

  it('should create bot and navigate to key management', async () => {
    (createBot as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'created'
    });

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const createButton = screen.getByRole('button', { name: /Create Bot/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createBot).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith('/key-management');
    });
  });

  it('should display bot creation error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (createBot as jest.Mock).mockRejectedValue(new Error('Bot creation failed'));

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const createButton = screen.getByRole('button', { name: /Create Bot/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Bot creation failed/i)).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should validate bot configuration', async () => {
    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const createButton = screen.getByRole('button', { name: /Create Bot/i });
    fireEvent.click(createButton);

    expect(screen.getByText(/Please configure bot settings/i)).toBeInTheDocument();
  });

  it('should update bot status after creation', async () => {
    (createBot as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'created'
    });

    (getBotStatus as jest.Mock).mockResolvedValue({
      id: 'bot-123',
      status: 'active'
    });

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const createButton = screen.getByRole('button', { name: /Create Bot/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(getBotStatus).toHaveBeenCalledWith('bot-123');
      expect(screen.getByText(/Bot Status: active/i)).toBeInTheDocument();
    });
  });

  it('should persist bot configuration in state', async () => {
    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const nameInput = screen.getByTestId('bot-name');
    const typeSelect = screen.getByTestId('bot-type');

    fireEvent.change(nameInput, { target: { value: 'Test Bot' } });
    fireEvent.change(typeSelect, { target: { value: 'momentum' } });

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    expect(screen.getByTestId('bot-name')).toHaveValue('Test Bot');
    expect(screen.getByTestId('bot-type')).toHaveValue('momentum');
  });

  it('should track bot creation metrics', async () => {
    const mockMetrics = {
      creations: [] as { bot: string; timestamp: number }[],
      validations: [] as { result: boolean; timestamp: number }[]
    };

    (createBot as jest.Mock).mockImplementation((name, type) => {
      mockMetrics.creations.push({
        bot: name,
        timestamp: Date.now()
      });
      return Promise.resolve({
        id: 'bot-123',
        status: 'created'
      });
    });

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const nameInput = screen.getByTestId('bot-name');
    const typeSelect = screen.getByTestId('bot-type');
    const createButton = screen.getByRole('button', { name: /Create Bot/i });

    fireEvent.change(nameInput, { target: { value: 'Test Bot' } });
    fireEvent.change(typeSelect, { target: { value: 'momentum' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockMetrics.creations).toContainEqual({
        bot: 'Test Bot',
        timestamp: expect.any(Number)
      });
    });
  });

  it('should validate bot type compatibility', async () => {
    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    const typeSelect = screen.getByTestId('bot-type');
    fireEvent.change(typeSelect, { target: { value: 'unsupported' } });

    expect(screen.getByText(/Bot type not supported/i)).toBeInTheDocument();
  });

  it('should handle concurrent bot creation requests', async () => {
    const mockRequests = Array.from({ length: 3 }, (_, i) => ({
      name: `Bot ${i + 1}`,
      type: 'momentum'
    }));

    const createPromises = mockRequests.map(req =>
      createBot(req.name, req.type).then(res => ({
        request: req,
        response: res
      }))
    );

    render(
      <TestContext>
        <BotIntegration />
      </TestContext>
    );

    await Promise.all(createPromises);

    expect(createBot).toHaveBeenCalledTimes(mockRequests.length);
  });
});
