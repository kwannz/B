import '@testing-library/jest-dom'
import React from 'react'

jest.mock('@thirdweb-dev/react', () => ({
  ThirdwebProvider: ({ children }) => children,
  useAddress: () => process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET === 'true' ? process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS : null,
  useBalance: () => ({ data: { displayValue: '100', symbol: 'SOL' }, isLoading: false }),
  ConnectWallet: () => <button>Configure New Agent</button>,
  useContract: () => ({ contract: null, isLoading: false }),
  useNetwork: () => [{ data: { chain: 'solana-devnet' } }, () => {}],
  useSolana: () => ({
    wallet: {
      publicKey: process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET === 'true' ? process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS : null,
      isConnected: process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET === 'true'
    }
  })
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn()
  }),
  useSearchParams: () => ({ get: () => 'trading' }),
  usePathname: () => '/'
}))

Object.defineProperty(window, 'phantom', {
  value: { solana: { isPhantom: true } },
  writable: true
})

global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({}), ok: true }))

jest.mock('@/api/client')
