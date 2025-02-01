import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor, RenderOptions } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TestMetrics, TradingConfig } from '@/app/tests/types/test.types'

interface MockProviderProps {
  children: React.ReactNode;
  activeChain?: string;
  tradingType?: 'dex-swap' | 'meme-coin';
  initialMetrics?: Partial<TestMetrics>;
  tradingConfig?: Partial<TradingConfig>;
  onError?: (error: Error) => void;
}

const MockThirdwebProvider: React.FC<MockProviderProps> = ({ 
  children,
  tradingType = 'dex-swap',
  initialMetrics,
  tradingConfig,
  onError
}) => {
  React.useEffect(() => {
    if (onError) {
      window.onerror = (message) => onError(new Error(String(message)));
    }
  }, [onError]);

  return <div data-trading-type={tradingType} data-testid="mock-provider">{children}</div>;
}

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn()
}

export const mockWallet = {
  address: 'mock-wallet-address',
  balance: { displayValue: '100', symbol: 'SOL' },
  isConnected: true
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn().mockImplementation(() => 
    Promise.resolve({ 
      ok: true, 
      json: () => Promise.resolve({}) 
    }) as Promise<Response>
  )
})

afterEach(() => {
  jest.restoreAllMocks()
})

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({ get: () => 'trading' }),
  usePathname: () => '/'
}))

jest.mock('@thirdweb-dev/react', () => ({
  ThirdwebProvider: ({ children }: { children: React.ReactNode }) => children,
  useAddress: jest.fn().mockImplementation(() => process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS || undefined),
  useBalance: jest.fn().mockImplementation(() => ({ data: mockWallet.balance, isLoading: false })),
  ConnectWallet: jest.fn().mockImplementation(() => <button>Configure New Agent</button>),
  useContract: jest.fn().mockImplementation(() => ({ contract: null, isLoading: false })),
  useNetwork: jest.fn().mockImplementation(() => [{ data: { chain: 'solana-devnet' } }, jest.fn()]),
  useSolana: jest.fn().mockImplementation(() => ({
    wallet: {
      publicKey: process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS || undefined,
      isConnected: !!process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS
    }
  }))
}))

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authenticated?: boolean;
  tradingType?: 'dex-swap' | 'meme-coin';
  initialMetrics?: Partial<TestMetrics>;
  tradingConfig?: Partial<TradingConfig>;
  onError?: (error: Error) => void;
}

const customRender = (
  ui: React.ReactElement,
  { 
    authenticated = false,
    tradingType = 'dex-swap',
    initialMetrics,
    tradingConfig,
    onError,
    ...options 
  }: CustomRenderOptions = {}
): RenderResult & {
  mockRouter: typeof mockRouter;
  mockWallet: typeof mockWallet;
  user: ReturnType<typeof userEvent.setup>;
  waitForLoadingToFinish: () => Promise<void>;
  waitForError: (errorMessage?: string) => Promise<void>;
} => {
  process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET = authenticated ? 'true' : 'false'
  process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS = authenticated ? mockWallet.address : undefined

  const AllTheProviders = ({ children }: { children: React.ReactNode }) => (
    <MockThirdwebProvider
      tradingType={tradingType}
      initialMetrics={initialMetrics}
      tradingConfig={tradingConfig}
      onError={onError}
    >
      {children}
    </MockThirdwebProvider>
  )

  const result = rtlRender(ui, { wrapper: AllTheProviders, ...options })
  const testUser = userEvent.setup()

  return {
    ...result,
    mockRouter,
    mockWallet,
    user: testUser,
    rerender: (ui: React.ReactElement) => customRender(ui, { authenticated, ...options }),
    waitForLoadingToFinish: async () => {
      await waitFor(
        () => {
          const spinner = screen.queryByTestId('loading-spinner')
          const error = screen.queryByTestId('error-message')
          if (spinner) throw new Error('Still loading')
          if (error) throw new Error(`Unexpected error: ${error.textContent}`)
        },
        { timeout: 4000, interval: 100 }
      )
    },
    waitForError: async (errorMessage?: string) => {
      await waitFor(
        () => {
          const error = screen.queryByTestId('error-message')
          const loading = screen.queryByTestId('loading-spinner')
          
          if (loading) throw new Error('Still loading')
          if (!error && errorMessage) throw new Error('No error message found')
          if (errorMessage && error && !error.textContent?.includes(errorMessage)) {
            throw new Error(`Expected error "${errorMessage}" but found "${error.textContent}"`)
          }
        },
        { timeout: 4000, interval: 100 }
      )
    }
  }
}

export { screen, fireEvent, waitFor }
export { customRender as render }
export type { RenderResult }
