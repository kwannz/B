import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThirdwebProvider } from "@thirdweb-dev/react"
import userEvent from '@testing-library/user-event'
import type { RenderResult } from '@testing-library/react'

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
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
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
  useAddress: () => process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS || null,
  useBalance: () => ({ data: mockWallet.balance, isLoading: false }),
  ConnectWallet: () => <button>Configure New Agent</button>,
  useContract: () => ({ contract: null, isLoading: false }),
  useNetwork: () => [{ data: { chain: 'solana-devnet' } }, jest.fn()],
  useSolana: () => ({
    wallet: {
      publicKey: process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS || null,
      isConnected: !!process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS
    }
  })
}))

interface RenderOptions {
  authenticated?: boolean
  [key: string]: any
}

const customRender = (
  ui: React.ReactElement,
  { authenticated = false, ...options }: RenderOptions = {}
): RenderResult & {
  mockRouter: typeof mockRouter
  mockWallet: typeof mockWallet
  user: ReturnType<typeof userEvent.setup>
  waitForLoadingToFinish: () => Promise<void>
  waitForError: (errorMessage?: string) => Promise<void>
} => {
  process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET = authenticated ? 'true' : 'false'
  process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS = authenticated ? mockWallet.address : null

  const AllTheProviders = ({ children }: { children: React.ReactNode }) => (
    <ThirdwebProvider activeChain="solana-devnet">
      {children}
    </ThirdwebProvider>
  )

  const result = rtlRender(ui, { wrapper: AllTheProviders, ...options })
  const user = userEvent.setup()

  return {
    ...result,
    mockRouter,
    mockWallet,
    user,
    rerender: (ui: React.ReactElement) => customRender(ui, { authenticated, ...options }),
    waitForLoadingToFinish: () =>
      waitFor(
        () => {
          const spinner = screen.queryByTestId('loading-spinner')
          if (spinner) throw new Error('Still loading')
        },
        { timeout: 2000 }
      ),
    waitForError: async (errorMessage?: string) =>
      waitFor(
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
      ),
    waitForLoadingToFinish: async () =>
      waitFor(
        () => {
          const spinner = screen.queryByTestId('loading-spinner')
          const error = screen.queryByTestId('error-message')
          if (spinner) throw new Error('Still loading')
          if (error) throw new Error(`Unexpected error: ${error.textContent}`)
        },
        { timeout: 4000, interval: 100 }
      )
  }
}

export { screen, fireEvent, waitFor }
export { customRender as render }
export type { RenderResult }
