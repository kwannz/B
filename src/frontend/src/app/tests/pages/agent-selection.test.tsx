import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { TestContext } from '../contexts/TestContext';
import AgentSelection from '@/app/agent-selection/page';

jest.mock('@solana/wallet-adapter-react');
jest.mock('next/navigation');

describe('AgentSelection Page', () => {
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

  it('should render available trading agents', async () => {
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    await waitFor(() => {
      expect(screen.getByText(/Select Trading Agent/i)).toBeInTheDocument();
    });

    const agentCards = screen.getAllByTestId('agent-card');
    expect(agentCards.length).toBeGreaterThan(0);
  });

  it('should navigate to strategy creation on agent selection', async () => {
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const firstAgentCard = screen.getAllByTestId('agent-card')[0];
    fireEvent.click(firstAgentCard);

    expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation');
  });

  it('should validate wallet connection before proceeding', async () => {
    (useWallet as jest.Mock).mockReturnValue({
      ...mockWallet,
      connected: false
    });

    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const firstAgentCard = screen.getAllByTestId('agent-card')[0];
    fireEvent.click(firstAgentCard);

    expect(screen.getByText(/Connect wallet to continue/i)).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('should display agent details and performance metrics', async () => {
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const agentCards = screen.getAllByTestId('agent-card');
    const firstAgent = agentCards[0];

    expect(firstAgent).toHaveTextContent(/Success Rate/i);
    expect(firstAgent).toHaveTextContent(/Avg Return/i);
    expect(firstAgent).toHaveTextContent(/Total Trades/i);
  });

  it('should handle agent selection errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const errorButton = screen.getByTestId('trigger-error');
    fireEvent.click(errorButton);

    expect(screen.getByText(/Error selecting agent/i)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('should persist selected agent in state', async () => {
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const agentCards = screen.getAllByTestId('agent-card');
    const selectedAgent = agentCards[0];
    const agentName = selectedAgent.textContent;

    fireEvent.click(selectedAgent);

    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const selectedAgentCard = screen.getByTestId('agent-card-selected');
    expect(selectedAgentCard).toHaveTextContent(agentName);
  });

  it('should filter agents by performance metrics', async () => {
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const filterSelect = screen.getByTestId('performance-filter');
    fireEvent.change(filterSelect, { target: { value: 'success_rate_high' } });

    const agentCards = screen.getAllByTestId('agent-card');
    const successRates = agentCards.map(card => 
      parseFloat(card.querySelector('[data-testid="success-rate"]').textContent)
    );

    expect(successRates).toEqual([...successRates].sort((a, b) => b - a));
  });

  it('should update metrics in real-time', async () => {
    jest.useFakeTimers();

    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const initialMetrics = screen.getAllByTestId('performance-metric');
    const initialValues = initialMetrics.map(metric => metric.textContent);

    jest.advanceTimersByTime(5000);

    const updatedMetrics = screen.getAllByTestId('performance-metric');
    const updatedValues = updatedMetrics.map(metric => metric.textContent);

    expect(updatedValues).not.toEqual(initialValues);

    jest.useRealTimers();
  });

  it('should validate agent compatibility with selected wallet', async () => {
    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const agentCards = screen.getAllByTestId('agent-card');
    const incompatibleAgent = agentCards.find(card => 
      card.getAttribute('data-compatible') === 'false'
    );

    fireEvent.click(incompatibleAgent);

    expect(screen.getByText(/Incompatible with current wallet/i)).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('should track agent selection metrics', async () => {
    const mockMetrics = {
      selections: [] as { agent: string; timestamp: number }[],
      performance: [] as { metric: string; value: number }[]
    };

    render(
      <TestContext>
        <AgentSelection />
      </TestContext>
    );

    const agentCards = screen.getAllByTestId('agent-card');
    const selectedAgent = agentCards[0];
    const agentName = selectedAgent.getAttribute('data-agent-name');

    fireEvent.click(selectedAgent);

    expect(mockMetrics.selections).toContainEqual({
      agent: agentName,
      timestamp: expect.any(Number)
    });

    const performanceMetrics = screen.getAllByTestId('performance-metric');
    performanceMetrics.forEach(metric => {
      const name = metric.getAttribute('data-metric-name');
      const value = parseFloat(metric.textContent);

      expect(mockMetrics.performance).toContainEqual({
        metric: name,
        value
      });
    });
  });
});
