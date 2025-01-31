import React from 'react'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import HomePage from '@/app/page'
import ErrorBoundary from '@/app/components/ErrorBoundary'

describe('HomePage', () => {
  describe('unauthenticated state', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET = 'false'
      process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS = null
    })

    it('renders landing page content', () => {
      render(<HomePage />, { authenticated: false })
      expect(screen.getByText(/Trading Dashboard/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Configure New Agent/i })).toBeInTheDocument()
      expect(screen.getByText(/Market Data Analyst/i)).toBeInTheDocument()
      expect(screen.getByText(/Valuation Agent/i)).toBeInTheDocument()
      const startTradingButton = screen.getByRole('button', { name: /Configure New Agent/i })
      expect(startTradingButton).toBeInTheDocument()
      expect(startTradingButton).toBeEnabled()
    })

    it('displays trading features', () => {
      render(<HomePage />, { authenticated: false })
      expect(screen.getByText(/Trading Agents Status/i)).toBeInTheDocument()
      expect(screen.getByText(/Market Data Analyst/i)).toBeInTheDocument()
      expect(screen.getByText(/Valuation Agent/i)).toBeInTheDocument()
    })

    it('shows agent status cards', () => {
      render(<HomePage />, { authenticated: false })
      expect(screen.getByText(/Trading Agents Status/i)).toBeInTheDocument()
      const activeChips = screen.getAllByText(/active/i, { selector: '.MuiChip-label' })
      expect(activeChips.length).toBeGreaterThan(0)
    })

    it('shows trading metrics', () => {
      render(<HomePage />, { authenticated: false })
      expect(screen.getByText(/Wallet Balance/i)).toBeInTheDocument()
      expect(screen.getByText(/Performance/i)).toBeInTheDocument()
      expect(screen.getByText(/Active Positions/i)).toBeInTheDocument()
    })
  })

  describe('authenticated state', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET = 'true'
      process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS = 'mock-wallet-address'
    })

    it('renders dashboard content', () => {
      render(<HomePage />, { authenticated: true })
      expect(screen.getByText(/Trading Dashboard/i)).toBeInTheDocument()
      expect(screen.getByText(/Connected Wallet:/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Configure New Agent/i })).toBeInTheDocument()
    })

    it('shows trading metrics', () => {
      render(<HomePage />, { authenticated: true })
      expect(screen.getByText(/Trading Agents Status/i)).toBeInTheDocument()
      expect(screen.getByText(/Market Data Analyst/i)).toBeInTheDocument()
      expect(screen.getByText(/Valuation Agent/i)).toBeInTheDocument()
    })

    it('handles navigation to agent selection', async () => {
      const { mockRouter, user } = render(<HomePage />, { authenticated: true })
      const button = screen.getByRole('button', { name: /Configure New Agent/i })
      expect(button).toBeEnabled()
      
      await user.click(button)
      expect(mockRouter.push).toHaveBeenCalledWith('/agent-selection')
    })

    it('handles loading and error states', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Failed to load metrics')))
      const { waitForError } = render(<HomePage />, { authenticated: true })
      await waitForError('Failed to load metrics')
      
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to load metrics/)
      const button = screen.getByRole('button', { name: /Configure New Agent/i })
      expect(button).toBeEnabled()
    })

    it('displays agent status', () => {
      render(<HomePage />, { authenticated: true })
      expect(screen.getByText(/Trading Agents Status/i)).toBeInTheDocument()
      const activeChips = screen.getAllByText(/active/i, { selector: '.MuiChip-label' })
      expect(activeChips.length).toBeGreaterThan(0)
    })

    it('shows start trading button', () => {
      render(<HomePage />, { authenticated: true })
      expect(screen.getByRole('button', { name: /Configure New Agent/i })).toBeInTheDocument()
    })

    it('handles error states with ErrorBoundary', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('API Error')))
      const { container, waitForError } = render(
        <ErrorBoundary>
          <HomePage />
        </ErrorBoundary>,
        { authenticated: true }
      )
      await waitForError('API Error')
      expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument()
      expect(container).toMatchSnapshot('Home Page - Error State')

      global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
      fireEvent.click(screen.getByTestId('error-boundary-retry'))
      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      })
      expect(container).toMatchSnapshot('Home Page - After Recovery')
    })
  })
})
