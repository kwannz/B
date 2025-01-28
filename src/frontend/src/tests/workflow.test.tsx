import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AgentSelection from '../pages/AgentSelection';
import StrategyCreation from '../pages/StrategyCreation';
import BotIntegration from '../pages/BotIntegration';
import KeyManagement from '../pages/KeyManagement';
import { AuthProvider } from '../contexts/AuthContext';
import { Toaster } from '../components/ui/toaster';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';

// Extend the timeout for async operations
vi.setConfig({ testTimeout: 10000 });

// Setup before each test
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
});

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

// Mock Buffer for the browser environment
global.Buffer = global.Buffer || require('buffer').Buffer;

// Mock modules before importing components
vi.mock('@solana/wallet-adapter-react', async () => {
  const actual = await vi.importActual('@solana/wallet-adapter-react');
  return {
    ...actual,
    useWallet: () => ({
      connected: true,
      publicKey: {
        toBase58: () => 'mock-wallet-address',
        toBuffer: () => Buffer.from('mock-wallet-address'),
        equals: () => true,
        toBytes: () => new Uint8Array(),
        toJSON: () => ({ type: 'mock', data: [] }),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signAllTransactions: vi.fn(),
      signMessage: vi.fn(),
    }),
    WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('../store/useWalletStore', async () => {
  const actual = await vi.importActual('../store/useWalletStore');
  return {
    ...actual,
    default: vi.fn(() => ({
      isAuthenticated: true,
      walletAddress: 'mock-wallet-address',
      balance: 1.5,
      isConnecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      setWalletAddress: vi.fn(),
      setBalance: vi.fn(),
      setIsConnecting: vi.fn(),
    })),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: {
        agentType: 'trading',
        strategy: {
          name: 'Test Strategy',
          description: 'Test Description',
          promotionWords: 'test, keywords',
          riskLevel: 'medium',
          targetProfit: '10',
          stopLoss: '5'
        },
        botId: 'test-bot-id'
      }
    }),
  };
});

const mockNavigate = vi.fn();

describe('Trading Workflow', () => {
  const renderWithProviders = (component: React.ReactNode) => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          {component}
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Agent Selection Step', async () => {
    await act(async () => {
      renderWithProviders(<AgentSelection />);
      
      // Wait for component to mount
      await waitFor(() => {
        expect(screen.getByText('Trading Agent')).toBeInTheDocument();
        expect(screen.getByText('DeFi Agent')).toBeInTheDocument();
      });
      
      // Select trading agent
      await act(async () => {
        fireEvent.click(screen.getByText('Trading Agent'));
      });
      
      // Click continue button
      const continueButton = screen.getByText('Continue to Strategy Creation');
      await act(async () => {
        fireEvent.click(continueButton);
      });
      
      // Verify navigation
      expect(mockNavigate).toHaveBeenCalledWith('/strategy-creation', {
        state: { agentType: 'trading' }
      });
    });
  });

  it('Strategy Creation Step', async () => {
    await act(async () => {
      renderWithProviders(<StrategyCreation />);
      
      // Wait for form to mount
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter strategy name')).toBeInTheDocument();
      });
      
      // Fill in strategy form
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Strategy Name'), {
          target: { value: 'Test Strategy' }
        });
        fireEvent.change(screen.getByLabelText('Strategy Description'), {
          target: { value: 'Test Description' }
        });
        fireEvent.change(screen.getByLabelText('Promotion Words'), {
          target: { value: 'test, keywords' }
        });
        fireEvent.change(screen.getByLabelText('Preferred Model'), {
          target: { value: 'deepseek-v3' }
        });
        fireEvent.change(screen.getByLabelText('Minimum Confidence'), {
          target: { value: '0.7' }
        });
        fireEvent.change(screen.getByLabelText('Risk Level'), {
          target: { value: 'medium' }
        });
        fireEvent.change(screen.getByLabelText('Timeframe'), {
          target: { value: '1h' }
        });
      });
      
      // Submit form
      const submitButton = screen.getByText('Create Strategy');
      await act(async () => {
        fireEvent.click(submitButton);
      });
      
      // Verify navigation
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/bot-integration', {
          state: expect.objectContaining({
            agentType: 'trading',
            strategy: expect.any(Object)
          })
        });
      }, { timeout: 5000 });
    });
  });

  it('Bot Integration Step', async () => {
    await act(async () => {
      const { rerender } = renderWithProviders(<BotIntegration />);
      
      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(/Initializing Bot/)).toBeInTheDocument();
      });
      
      // Wait for bot initialization
      await waitFor(() => {
        expect(screen.getByText('Bot Successfully Initialized')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      rerender(<BotIntegration />);
      
      // Verify bot details are displayed
      expect(screen.getByText(/Agent Type: trading/)).toBeInTheDocument();
      expect(screen.getByText(/Strategy Name: Test Strategy/)).toBeInTheDocument();
      
      // Continue to key management
      const continueButton = screen.getByText('Continue to Key Management');
      await act(async () => {
        fireEvent.click(continueButton);
      });
      
      // Verify navigation
      expect(mockNavigate).toHaveBeenCalledWith('/key-management', {
        state: expect.objectContaining({
          agentType: 'trading',
          strategy: expect.any(Object),
          botId: expect.any(String)
        })
      });
    });
  });

  it('Key Management Step', async () => {
    await act(async () => {
      const { rerender } = renderWithProviders(<KeyManagement />);
      
      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(/Generating Wallet/)).toBeInTheDocument();
      });
      
      // Wait for wallet generation
      await waitFor(() => {
        expect(screen.getByText('Wallet Generated')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      rerender(<KeyManagement />);
      
      // Verify wallet details are displayed
      expect(screen.getByText('Wallet Address')).toBeInTheDocument();
      expect(screen.getByText('Private Key')).toBeInTheDocument();
      
      // Continue to dashboard
      const continueButton = screen.getByText('Continue to Dashboard');
      await act(async () => {
        fireEvent.click(continueButton);
      });
      
      // Verify navigation
      expect(mockNavigate).toHaveBeenCalledWith('/trading-agent/dashboard', {
        state: expect.objectContaining({
          agentType: 'trading',
          strategy: expect.any(Object),
          botId: expect.any(String),
          walletAddress: expect.any(String)
        })
      });
    });
  });
});
