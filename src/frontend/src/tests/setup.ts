import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({
      state: {
        agentType: 'trading',
        strategy: {
          name: 'Test Strategy',
          description: 'Test Description',
          promotionWords: 'test, keywords'
        }
      }
    })
  };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock API services
vi.mock('../services/api', () => ({
  createBot: vi.fn().mockResolvedValue({ id: 'test-bot-id' }),
  generateWallet: vi.fn().mockResolvedValue({
    address: 'test-wallet-address',
    privateKey: 'test-private-key'
  }),
  getTradingHistory: vi.fn().mockResolvedValue([{
    id: '1',
    type: 'BUY',
    amount: 1.5,
    price: 50000,
    timestamp: new Date().toISOString(),
    status: 'COMPLETED'
  }])
}));
