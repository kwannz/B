import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/test-utils'
import AgentSelection from '@/app/agent-selection/page'
import StrategyCreation from '@/app/strategy-creation/page'
import BotIntegration from '@/app/(auth)/bot-integration/page'
import WalletCreation from '@/app/(auth)/wallet-creation/page'
import KeyManagement from '@/app/(auth)/key-management/page'
import Dashboard from '@/app/(auth)/dashboard/page'
import DeveloperDashboard from '@/app/(auth)/developer/page'
import UserDashboard from '@/app/(auth)/user/page'
import HomePage from '@/app/page'

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
  forward: jest.fn()
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({ get: () => 'trading' }),
  usePathname: () => '/'
}))

describe('Trading Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET = 'true'
    process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS = 'mock-wallet-address'
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Agent Selection', () => {
    it('renders agent selection options', () => {
      const { container } = render(<AgentSelection />, { authenticated: true })
      expect(screen.getByText(/Select Your Agent/i)).toBeInTheDocument()
      expect(screen.getByText(/Trading Agent/i)).toBeInTheDocument()
      expect(screen.getByText(/DeFi Agent/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })

    it('handles agent selection', async () => {
      const { mockRouter, waitForLoadingToFinish } = render(<AgentSelection />, { authenticated: true })
      await waitForLoadingToFinish()
      fireEvent.click(screen.getByText(/Select Trading Agent/i))
      expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation?type=trading')
    })

    it('handles unauthenticated state', () => {
      process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET = 'false'
      render(<AgentSelection />, { authenticated: false })
      expect(screen.getByText(/Please connect your wallet/i)).toBeInTheDocument()
    })
  })

  describe('Strategy Creation', () => {
    it('renders strategy form', () => {
      const { container } = render(<StrategyCreation />, { authenticated: true })
      expect(screen.getByText(/Create Your Strategy/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Trading Strategy/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Promotion Words/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })

    it('handles form validation', async () => {
      const { mockRouter, waitForLoadingToFinish } = render(<StrategyCreation />, { authenticated: true })
      await waitForLoadingToFinish()
      const submitButton = screen.getByRole('button', { name: /Create Strategy/i })
      
      fireEvent.click(submitButton)
      expect(screen.getByText(/Please fill in all fields/i)).toBeInTheDocument()
      
      const strategyInput = screen.getByLabelText(/Trading Strategy/i)
      const promotionInput = screen.getByLabelText(/Promotion Words/i)
      
      fireEvent.change(strategyInput, { target: { value: 'Buy BTC when RSI < 30' } })
      fireEvent.change(promotionInput, { target: { value: 'RSI-based trading' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/bot-integration?type=trading')
      })
    })
  })

  describe('Bot Integration', () => {
    it('shows integration status', () => {
      const { container } = render(<BotIntegration />, { authenticated: true })
      expect(screen.getByText(/Bot Integration/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })

    it('handles integration flow', async () => {
      render(<BotIntegration />, { authenticated: true })
      
      await waitFor(() => {
        expect(screen.getByText(/Status: Ready/i)).toBeInTheDocument()
        const continueButton = screen.getByRole('button', { name: /Continue to Wallet Creation/i })
        fireEvent.click(continueButton)
        expect(mockRouter.push).toHaveBeenCalledWith('/wallet-creation?type=trading')
      })
    })
  })

  describe('Wallet Creation', () => {
    it('displays wallet information', () => {
      const { container } = render(<WalletCreation />, { authenticated: true })
      expect(screen.getByText(/Wallet Creation/i)).toBeInTheDocument()
      expect(screen.getByText(/New SOL Wallet/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })

    it('handles wallet creation flow', async () => {
      render(<WalletCreation />, { authenticated: true })
      
      await waitFor(() => {
        const continueButton = screen.getByRole('button', { name: /Continue to Key Management/i })
        fireEvent.click(continueButton)
        expect(mockRouter.push).toHaveBeenCalledWith('/key-management?type=trading')
      })
    })
  })

  describe('Key Management', () => {
    it('shows key management interface', () => {
      const { container } = render(<KeyManagement />, { authenticated: true })
      expect(screen.getByText(/Key Management/i)).toBeInTheDocument()
      expect(screen.getByText(/Trading Bot Keys/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })

    it('handles key storage flow', async () => {
      render(<KeyManagement />, { authenticated: true })
      
      await waitFor(() => {
        expect(screen.getByText(/Private key has been securely stored/i)).toBeInTheDocument()
        const continueButton = screen.getByRole('button', { name: /Continue to Dashboard/i })
        fireEvent.click(continueButton)
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard?type=trading')
      })
    })
  })

  describe('Dashboard', () => {
    it('renders trading dashboard', () => {
      const { container } = render(<Dashboard />, { authenticated: true })
      expect(screen.getByText(/Trading Dashboard/i)).toBeInTheDocument()
      expect(screen.getByText(/Connected Wallet:/i)).toBeInTheDocument()
      expect(container).toMatchSnapshot()
    })

    it('displays trading metrics', () => {
      render(<Dashboard />, { authenticated: true })
      expect(screen.getByText(/Wallet Balance/i)).toBeInTheDocument()
      expect(screen.getByText(/Performance/i)).toBeInTheDocument()
      expect(screen.getByText(/Active Positions/i)).toBeInTheDocument()
    })
  })

  describe('Developer Dashboard', () => {
    it('shows system metrics', () => {
      render(<DeveloperDashboard />, { authenticated: true })
      const metricsSection = screen.getByTestId('system-metrics')
      expect(metricsSection).toHaveTextContent(/CPU Usage/i)
      expect(metricsSection).toHaveTextContent(/Memory Usage/i)
      expect(metricsSection).toHaveTextContent(/Active Connections/i)
    })

    it('displays API status', () => {
      render(<DeveloperDashboard />, { authenticated: true })
      const apiStatus = screen.getByTestId('api-status')
      expect(apiStatus).toHaveTextContent(/Trading API/i)
      expect(apiStatus).toHaveTextContent(/Analytics API/i)
      expect(apiStatus).toHaveTextContent(/Wallet API/i)
    })
  })

  describe('User Dashboard', () => {
    it('shows trading history', () => {
      render(<UserDashboard />, { authenticated: true })
      const historySection = screen.getByTestId('trading-history')
      expect(historySection).toHaveTextContent(/Recent Trades/i)
      expect(historySection).toHaveTextContent(/Performance/i)
    })

    it('displays balance information', () => {
      render(<UserDashboard />, { authenticated: true })
      const balanceSection = screen.getByTestId('account-balance')
      expect(balanceSection).toHaveTextContent(/Available Balance/i)
      expect(balanceSection).toHaveTextContent(/Locked in Trades/i)
    })
  })

  describe('Complete Workflow Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET = 'true'
      process.env.NEXT_PUBLIC_MOCK_WALLET_ADDRESS = 'mock-wallet-address'
      global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({}), ok: true }))
    })

    it('validates end-to-end trading workflow', async () => {
      // Agent Selection
      const { mockRouter, waitForLoadingToFinish } = render(<AgentSelection />, { authenticated: true })
      expect(screen.getByText(/Select Your Agent/i)).toBeInTheDocument()
      const tradingButton = screen.getByText(/Select Trading Agent/i)
      fireEvent.click(tradingButton)
      await waitForLoadingToFinish()
      expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation?type=trading')

      // Strategy Creation
      const { waitForLoadingToFinish: waitForStrategyLoading } = render(<StrategyCreation />, { authenticated: true })
      await waitForStrategyLoading()
      
      const strategyInput = screen.getByLabelText(/Trading Strategy/i)
      const promotionInput = screen.getByLabelText(/Promotion Words/i)
      
      fireEvent.change(strategyInput, { target: { value: 'Buy BTC when RSI < 30' } })
      fireEvent.change(promotionInput, { target: { value: 'RSI-based trading' } })
      
      const createButton = screen.getByRole('button', { name: /Create Strategy/i })
      fireEvent.click(createButton)
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/bot-integration?type=trading')
      })

      // Bot Integration
      render(<BotIntegration />, { authenticated: true })
      await waitFor(() => {
        expect(screen.getByText(/Bot Integration/i)).toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText(/Status: Ready/i)).toBeInTheDocument()
      })
      const botContinueButton = screen.getByRole('button', { name: /Continue to Wallet Creation/i })
      fireEvent.click(botContinueButton)
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/wallet-creation?type=trading')
      })

      // Wallet Creation
      const { waitForLoadingToFinish: waitForWalletLoading } = render(<WalletCreation />, { authenticated: true })
      await waitForWalletLoading()
      
      expect(screen.getByText(/Wallet Creation/i)).toBeInTheDocument()
      const walletAddress = screen.getByTestId('wallet-address')
      expect(walletAddress).toHaveTextContent(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
      
      const walletContinueButton = screen.getByRole('button', { name: /Continue to Key Management/i })
      fireEvent.click(continueButton)
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/key-management?type=trading')
      })

      // Key Management
      const { waitForLoadingToFinish: waitForKeyLoading } = render(<KeyManagement />, { authenticated: true })
      await waitForKeyLoading()
      
      expect(screen.getByText(/Key Management/i)).toBeInTheDocument()
      expect(screen.getByText(/Private key has been securely stored/i)).toBeInTheDocument()
      
      const dashboardButton = screen.getByRole('button', { name: /Continue to Dashboard/i })
      fireEvent.click(dashboardButton)
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard?type=trading')
      })

      // Dashboard
      const { waitForLoadingToFinish: waitForDashboardLoading, container: dashboardContainer } = render(<Dashboard />, { authenticated: true })
      await waitForDashboardLoading()
      
      expect(screen.getByText(/Trading Dashboard/i)).toBeInTheDocument()
      expect(screen.getByTestId('trading-metrics')).toBeInTheDocument()
      expect(screen.getByTestId('agent-status')).toBeInTheDocument()
      
      // Verify trading metrics
      const metricsSection = screen.getByTestId('trading-metrics')
      expect(metricsSection).toHaveTextContent(/Wallet Balance/i)
      expect(metricsSection).toHaveTextContent(/Performance/i)
      expect(metricsSection).toHaveTextContent(/Active Positions/i)
      
      // Verify agent status
      const agentStatus = screen.getByTestId('agent-status')
      expect(agentStatus).toHaveTextContent(/Market Data Analyst/i)
      expect(agentStatus).toHaveTextContent(/Valuation Agent/i)
      expect(agentStatus).toHaveTextContent(/active/i)
      
      expect(dashboardContainer).toMatchSnapshot()
      
      // Test developer dashboard
      const { container: devContainer } = render(<DeveloperDashboard />, { authenticated: true })
      const devMetrics = screen.getByTestId('system-metrics')
      expect(devMetrics).toHaveTextContent(/CPU Usage/i)
      expect(devMetrics).toHaveTextContent(/Memory Usage/i)
      expect(devMetrics).toHaveTextContent(/Active Connections/i)
      expect(devContainer).toMatchSnapshot()
      
      // Test user dashboard
      const { container: userContainer } = render(<UserDashboard />, { authenticated: true })
      const historySection = screen.getByTestId('trading-history')
      expect(historySection).toHaveTextContent(/Recent Trades/i)
      expect(historySection).toHaveTextContent(/Performance/i)
      expect(userContainer).toMatchSnapshot()
    })

    it('handles error states throughout workflow', async () => {
      // Bot Integration Error
      global.fetch = jest.fn(() => Promise.reject(new Error('Failed to initialize bot')))
      const { waitForError: waitForBotError, user: botUser } = render(<BotIntegration />, { authenticated: true })
      await waitForBotError('Failed to initialize bot')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to initialize bot/)
      expect(screen.queryByRole('button', { name: /Continue to Wallet Creation/i })).not.toBeInTheDocument()
      expect(screen.getByText(/Bot Integration/i)).toBeInTheDocument()

      // Wallet Creation Error
      global.fetch = jest.fn(() => Promise.reject(new Error('Failed to create wallet')))
      const { waitForError: waitForWalletError, user: walletUser } = render(<WalletCreation />, { authenticated: true })
      await waitForWalletError('Failed to create wallet')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to create wallet/)
      expect(screen.queryByRole('button', { name: /Continue to Key Management/i })).not.toBeInTheDocument()
      expect(screen.getByText(/Wallet Creation/i)).toBeInTheDocument()

      // Key Management Error
      global.fetch = jest.fn(() => Promise.reject(new Error('Failed to store keys')))
      const { waitForError: waitForKeyError, user: keyUser } = render(<KeyManagement />, { authenticated: true })
      await waitForKeyError('Failed to store keys')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to store keys/)
      expect(screen.queryByRole('button', { name: /Continue to Dashboard/i })).not.toBeInTheDocument()
      expect(screen.getByText(/Key Management/i)).toBeInTheDocument()

      // Strategy Creation Error
      global.fetch = jest.fn(() => Promise.reject(new Error('Failed to create strategy')))
      const { waitForError: waitForStrategyError, user: strategyErrorUser } = render(<StrategyCreation />, { authenticated: true })
      await waitForStrategyError('Failed to create strategy')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to create strategy/)
      expect(screen.getByText(/Create Your Strategy/i)).toBeInTheDocument()

      // Test error recovery with retry
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
      
      const { waitForError, waitForLoadingToFinish, user: retryUser } = render(<BotIntegration />, { authenticated: true })
      await waitForError('Temporary error')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Temporary error/)
      
      const retryButton = screen.getByRole('button', { name: /Retry/i })
      await retryUser.click(retryButton)
      await waitForLoadingToFinish()
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Continue to Wallet Creation/i })).toBeInTheDocument()

      // Test workflow navigation sequence
      const testWorkflowNavigation = async () => {
        // Agent Selection
        const { mockRouter: navRouter, user: navUser } = render(<AgentSelection />, { authenticated: true })
        const navTradingButton = screen.getByRole('button', { name: /Trading Agent/i })
        await navUser.click(navTradingButton)
        expect(navRouter.push).toHaveBeenCalledWith('/strategy-creation?type=trading')
        expect(screen.getByText(/Select Your Trading Agent/i)).toBeInTheDocument()

        // Strategy Creation
        const { mockRouter: strategyRouter, user: strategyUser } = render(<StrategyCreation />, { authenticated: true })
        const strategyCreateButton = screen.getByRole('button', { name: /Create Strategy/i })
        await strategyUser.click(strategyCreateButton)
        expect(strategyRouter.push).toHaveBeenCalledWith('/bot-integration?type=trading')
        expect(screen.getByText(/Create Your Strategy/i)).toBeInTheDocument()

        // Bot Integration
        const { mockRouter: botRouter, user: botUser } = render(<BotIntegration />, { authenticated: true })
        const botContinueButton = screen.getByRole('button', { name: /Continue to Wallet Creation/i })
        await botUser.click(botContinueButton)
        expect(botRouter.push).toHaveBeenCalledWith('/wallet-creation?type=trading')
        expect(screen.getByText(/Bot Integration/i)).toBeInTheDocument()

        // Wallet Creation
        const { mockRouter: walletRouter, user: walletUser } = render(<WalletCreation />, { authenticated: true })
        const walletContinueButton = screen.getByRole('button', { name: /Continue to Key Management/i })
        await walletUser.click(walletContinueButton)
        expect(walletRouter.push).toHaveBeenCalledWith('/key-management?type=trading')
        expect(screen.getByText(/Wallet Creation/i)).toBeInTheDocument()

        // Key Management
        const { mockRouter: keyRouter, user: keyUser } = render(<KeyManagement />, { authenticated: true })
        const keyDashboardButton = screen.getByRole('button', { name: /Continue to Dashboard/i })
        await keyUser.click(keyDashboardButton)
        expect(keyRouter.push).toHaveBeenCalledWith('/dashboard')
        expect(screen.getByText(/Key Management/i)).toBeInTheDocument()
      }

      await testWorkflowNavigation()

      // Test DeFi agent workflow
      const testDeFiWorkflow = async () => {
        // DeFi agent selection
        const { mockRouter: defiRouter, user: defiUser } = render(<AgentSelection />, { authenticated: true })
        const defiAgentButton = screen.getByRole('button', { name: /DeFi Agent/i })
        await defiUser.click(defiAgentButton)
        expect(defiRouter.push).toHaveBeenCalledWith('/strategy-creation?type=defi')
        expect(screen.getByText(/Select Your Trading Agent/i)).toBeInTheDocument()

        // DeFi strategy creation
        const { mockRouter: defiStrategyRouter, user: defiStrategyUser } = render(<StrategyCreation />, { authenticated: true })
        const defiStrategyButton = screen.getByRole('button', { name: /Create Strategy/i })
        await defiStrategyUser.click(defiStrategyButton)
        expect(defiStrategyRouter.push).toHaveBeenCalledWith('/bot-integration?type=defi')

        // DeFi bot integration
        const { mockRouter: defiBotRouter, user: defiBotUser } = render(<BotIntegration />, { authenticated: true })
        const defiBotButton = screen.getByRole('button', { name: /Continue to Wallet Creation/i })
        await defiBotUser.click(defiBotButton)
        expect(defiBotRouter.push).toHaveBeenCalledWith('/wallet-creation?type=defi')

        // DeFi wallet creation
        const { mockRouter: defiWalletRouter, user: defiWalletUser } = render(<WalletCreation />, { authenticated: true })
        const defiWalletButton = screen.getByRole('button', { name: /Continue to Key Management/i })
        await defiWalletUser.click(defiWalletButton)
        expect(defiWalletRouter.push).toHaveBeenCalledWith('/key-management?type=defi')

        // DeFi key management
        const { mockRouter: defiKeyRouter, user: defiKeyUser } = render(<KeyManagement />, { authenticated: true })
        const defiKeyButton = screen.getByRole('button', { name: /Continue to Dashboard/i })
        await defiKeyUser.click(defiKeyButton)
        expect(defiKeyRouter.push).toHaveBeenCalledWith('/dashboard')
      }

      await testDeFiWorkflow()

      // Test error handling and recovery
      const testErrorHandlingAndRecovery = async () => {
        // Strategy creation error and recovery
        global.fetch = jest.fn()
          .mockRejectedValueOnce(new Error('Strategy validation failed'))
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
        const { waitForError: waitForStrategyError, user: strategyUser } = render(<StrategyCreation />, { authenticated: true })
        await waitForStrategyError('Strategy validation failed')
        const strategyRetryButton = screen.getByRole('button', { name: /Retry/i })
        await strategyUser.click(strategyRetryButton)
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()

        // Bot integration error and recovery
        global.fetch = jest.fn()
          .mockRejectedValueOnce(new Error('Bot initialization failed'))
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
        const { waitForError: waitForBotError, user: botUser } = render(<BotIntegration />, { authenticated: true })
        await waitForBotError('Bot initialization failed')
        const botRetryButton = screen.getByRole('button', { name: /Retry/i })
        await botUser.click(botRetryButton)
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()

        // Wallet creation error and recovery
        global.fetch = jest.fn()
          .mockRejectedValueOnce(new Error('Wallet creation failed'))
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
        const { waitForError: waitForWalletError, user: walletUser } = render(<WalletCreation />, { authenticated: true })
        await waitForWalletError('Wallet creation failed')
        const walletRetryButton = screen.getByRole('button', { name: /Retry/i })
        await walletUser.click(walletRetryButton)
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()

        // Key management error and recovery
        global.fetch = jest.fn()
          .mockRejectedValueOnce(new Error('Key management failed'))
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
        const { waitForError: waitForKeyError, user: keyUser } = render(<KeyManagement />, { authenticated: true })
        await waitForKeyError('Key management failed')
        const keyRetryButton = screen.getByRole('button', { name: /Retry/i })
        await keyUser.click(keyRetryButton)
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()

        // Test network timeout handling
        global.fetch = jest.fn()
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
        const { waitForError: waitForTimeoutError, user: timeoutUser } = render(<BotIntegration />, { authenticated: true })
        await waitForTimeoutError('Network timeout')
        const timeoutRetryButton = screen.getByRole('button', { name: /Retry/i })
        await timeoutUser.click(timeoutRetryButton)
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()

        // Test unauthorized access handling
        global.fetch = jest.fn()
          .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Unauthorized' }) })
        const { waitForError: waitForAuthError } = render(<KeyManagement />, { authenticated: false })
        await waitForAuthError('Unauthorized')
        expect(screen.getByTestId('error-message')).toHaveTextContent(/Unauthorized/)
      }

      await testErrorHandlingAndRecovery()
      global.fetch = jest.fn(() => Promise.reject(new Error('Strategy validation failed')))
      const strategyErrorButton = screen.getByRole('button', { name: /Create Strategy/i })
      await strategyErrorUser.click(strategyErrorButton)
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Strategy validation failed/)

      // Test retry after error
      global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }))
      await strategyErrorUser.click(strategyErrorButton)
      expect(strategyErrorRouter.push).toHaveBeenCalledWith('/bot-integration?type=defi')
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()

      // Test error handling and recovery for each workflow step
      const testWorkflowErrors = async () => {
        const testComponentError = async (
          Component: React.ComponentType,
          errorMessage: string,
          successMessage: string,
          buttonText: RegExp
        ) => {
          global.fetch = jest.fn()
            .mockRejectedValueOnce(new Error(errorMessage))
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, message: successMessage }) })
          
          const { waitForError, waitForLoadingToFinish, user } = render(<Component />, { authenticated: true })
          await waitForError(errorMessage)
          expect(screen.getByTestId('error-message')).toHaveTextContent(errorMessage)
          
          const retryButton = screen.getByRole('button', { name: /Retry/i })
          await user.click(retryButton)
          await waitForLoadingToFinish()
          
          expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
          const continueButton = screen.getByRole('button', { name: buttonText })
          expect(continueButton).toBeEnabled()
        }

        // Test each workflow component
        await testComponentError(
          BotIntegration,
          'Bot initialization failed',
          'Bot initialized successfully',
          /Continue to Wallet Creation/i
        )

        await testComponentError(
          StrategyCreation,
          'Strategy validation failed',
          'Strategy created successfully',
          /Create Strategy/i
        )

        await testComponentError(
          WalletCreation,
          'Wallet creation failed',
          'Wallet created successfully',
          /Continue to Key Management/i
        )

        await testComponentError(
          KeyManagement,
          'Key management failed',
          'Keys stored successfully',
          /Continue to Dashboard/i
        )

        // Test network timeout and recovery
        global.fetch = jest.fn()
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
        
        const { waitForError, waitForLoadingToFinish, user } = render(<BotIntegration />, { authenticated: true })
        await waitForError('Network timeout')
        const retryButton = screen.getByRole('button', { name: /Retry/i })
        await user.click(retryButton)
        await waitForLoadingToFinish()
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()

        // Test unauthorized access
        global.fetch = jest.fn().mockResolvedValueOnce({ 
          ok: false, 
          status: 401, 
          json: () => Promise.resolve({ message: 'Unauthorized access' }) 
        })
        
        const { waitForError: waitForAuthError } = render(<KeyManagement />, { authenticated: false })
        await waitForAuthError('Unauthorized')
        expect(screen.getByTestId('error-message')).toHaveTextContent(/Unauthorized/)
      }

      await testWorkflowErrors()

      // Test successful bot integration
      global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }))
      const botSuccessButton = screen.getByRole('button', { name: /Continue to Wallet Creation/i })
      await botErrorUser.click(botSuccessButton)
      expect(botErrorRouter.push).toHaveBeenCalledWith('/wallet-creation?type=defi')

      // Test wallet balance validation
      const { mockRouter: walletBalanceRouter, user: walletBalanceUser, waitForError: waitForBalanceError } = render(<WalletCreation />, { authenticated: true })
      jest.spyOn(require('@thirdweb-dev/react'), 'useBalance').mockReturnValue({ data: { displayValue: '0.1', symbol: 'SOL' }, isLoading: false })
      const walletKeyManagementButton = screen.getByRole('button', { name: /Continue to Key Management/i })
      await walletBalanceUser.click(walletKeyManagementButton)
      await waitForBalanceError('Insufficient balance')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Insufficient balance/)

      // Test successful wallet creation with sufficient balance
      jest.spyOn(require('@thirdweb-dev/react'), 'useBalance').mockReturnValue({ data: { displayValue: '1.0', symbol: 'SOL' }, isLoading: false })
      await walletBalanceUser.click(walletKeyManagementButton)
      expect(walletBalanceRouter.push).toHaveBeenCalledWith('/key-management?type=defi')

      // Test key management error handling
      const { mockRouter: keyErrorRouter, user: keyErrorUser, waitForError: waitForKeyManagementError } = render(<KeyManagement />, { authenticated: true })
      global.fetch = jest.fn(() => Promise.reject(new Error('Key generation failed')))
      const keyErrorDashboardButton = screen.getByRole('button', { name: /Continue to Dashboard/i })
      await keyErrorUser.click(keyErrorDashboardButton)
      await waitForKeyManagementError('Key generation failed')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Key generation failed/)

      // Test successful key management completion
      global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }))
      await keyErrorUser.click(keyErrorDashboardButton)
      expect(keyErrorRouter.push).toHaveBeenCalledWith('/dashboard')
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()

      // Test navigation with loading states
      const { mockRouter: loadingStateRouter, user: loadingStateUser, waitForLoadingToFinish } = render(<AgentSelection />, { authenticated: true })
      jest.spyOn(require('@thirdweb-dev/react'), 'useBalance').mockReturnValue({ data: null, isLoading: true })
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

      // Test navigation with network errors
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))
      const networkErrorTradingButton = screen.getByRole('button', { name: /Trading Agent/i })
      await loadingStateUser.click(networkErrorTradingButton)
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Network error/)
      
      // Test error boundary recovery
      const { container: errorBoundaryContainer } = render(
        <ErrorBoundary>
          <AgentSelection />
        </ErrorBoundary>,
        { authenticated: true }
      )
      expect(errorBoundaryContainer).toMatchSnapshot('Error Boundary - Agent Selection')

      // Test retry mechanism after network error
      global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }))
      await loadingStateUser.click(networkErrorTradingButton)
      expect(loadingStateRouter.push).toHaveBeenCalledWith('/strategy-creation?type=trading')
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()

      // Test navigation with insufficient balance
      jest.spyOn(require('@thirdweb-dev/react'), 'useBalance').mockReturnValue({ data: { displayValue: '0.1', symbol: 'SOL' }, isLoading: false })
      await loadingStateUser.click(networkErrorTradingButton)
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Insufficient balance/)

      // Test loading states
      global.fetch = jest.fn(() => new Promise(() => {})) // Never resolves
      
      // Bot Integration Loading
      const { container: botLoadingContainer, waitForLoadingToFinish: waitForBotLoadingFinish, user: botLoadingUser, mockRouter: botLoadingRouter } = render(<BotIntegration />, { authenticated: true })
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Continue to Wallet Creation/i })).not.toBeInTheDocument()
      expect(screen.getByText(/Bot Integration/i)).toBeInTheDocument()
      expect(botLoadingContainer).toMatchSnapshot('Bot Integration Loading')
      
      // Wallet Creation Loading
      const { container: walletLoadingContainer, waitForLoadingToFinish: waitForWalletLoadingFinish, user: walletLoadingUser, mockRouter: walletLoadingRouter } = render(<WalletCreation />, { authenticated: true })
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Continue to Key Management/i })).not.toBeInTheDocument()
      expect(screen.getByText(/Wallet Creation/i)).toBeInTheDocument()
      expect(walletLoadingContainer).toMatchSnapshot('Wallet Creation Loading')
      
      // Key Management Loading
      const { container: keyManagementLoadingContainer, waitForLoadingToFinish: waitForKeyLoadingFinish, user: keyLoadingUser, mockRouter: keyLoadingRouter } = render(<KeyManagement />, { authenticated: true })
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Continue to Dashboard/i })).not.toBeInTheDocument()
      expect(screen.getByText(/Key Management/i)).toBeInTheDocument()
      expect(keyManagementLoadingContainer).toMatchSnapshot('Key Management Loading')
      
      // Strategy Creation Loading
      const { container: strategyLoadingContainer, waitForLoadingToFinish: waitForStrategyLoadingFinish, user: strategyLoadingUser, mockRouter: strategyLoadingRouter } = render(<StrategyCreation />, { authenticated: true })
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Create Strategy/i })).not.toBeInTheDocument()
      expect(screen.getByText(/Create Your Strategy/i)).toBeInTheDocument()
      expect(strategyLoadingContainer).toMatchSnapshot('Strategy Creation Loading')
      
      // Test timeout and network errors
      jest.useFakeTimers()
      
      // Bot Integration timeout
      const { waitForError: waitForBotTimeout, user: botTimeoutUser, mockRouter: botTimeoutRouter } = render(<BotIntegration />, { authenticated: true })
      jest.advanceTimersByTime(30000)
      await waitForBotTimeout('Request timed out')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Request timed out/)
      
      // Wallet Creation timeout
      const { waitForError: waitForWalletTimeout, user: walletTimeoutUser, mockRouter: walletTimeoutRouter } = render(<WalletCreation />, { authenticated: true })
      jest.advanceTimersByTime(30000)
      await waitForWalletTimeout('Failed to create wallet')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to create wallet/)
      
      // Key Management timeout
      const { waitForError: waitForKeyTimeout, user: keyTimeoutUser, mockRouter: keyTimeoutRouter } = render(<KeyManagement />, { authenticated: true })
      jest.advanceTimersByTime(30000)
      await waitForKeyTimeout('Failed to manage keys')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to manage keys/)
      
      // Strategy Creation timeout
      const { waitForError: waitForStrategyTimeout, user: strategyTimeoutUser, mockRouter: strategyTimeoutRouter } = render(<StrategyCreation />, { authenticated: true })
      jest.advanceTimersByTime(30000)
      await waitForStrategyTimeout('Failed to create strategy')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to create strategy/)
      
      // Network error handling
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))
      
      // Strategy Creation network error
      const { waitForError: waitForStrategyNetworkError, user: strategyNetworkUser, mockRouter: strategyNetworkRouter } = render(<StrategyCreation />, { authenticated: true })
      await waitForStrategyNetworkError('Network error')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Network error/)
      expect(screen.queryByRole('button', { name: /Create Strategy/i })).not.toBeInTheDocument()
      
      // Bot Integration network error
      const { waitForError: waitForBotNetworkError, user: botNetworkUser, mockRouter: botNetworkRouter } = render(<BotIntegration />, { authenticated: true })
      await waitForBotNetworkError('Network error')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Network error/)
      expect(screen.queryByRole('button', { name: /Continue to Wallet Creation/i })).not.toBeInTheDocument()
      
      // Wallet Creation network error
      const { waitForError: waitForWalletNetworkError, user: walletNetworkUser, mockRouter: walletNetworkRouter } = render(<WalletCreation />, { authenticated: true })
      await waitForWalletNetworkError('Network error')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Network error/)
      expect(screen.queryByRole('button', { name: /Continue to Key Management/i })).not.toBeInTheDocument()
      
      // Key Management network error
      const { waitForError: waitForKeyNetworkError, user: keyNetworkUser, mockRouter: keyNetworkRouter } = render(<KeyManagement />, { authenticated: true })
      await waitForKeyNetworkError('Network error')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Network error/)
      
      // Test retry mechanisms
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'success' }) })
      
      // Strategy Creation retry
      const { waitForLoadingToFinish: waitForStrategyRetry, user: strategyRetryUser } = render(<StrategyCreation />, { authenticated: true })
      await strategyRetryUser.click(screen.getByRole('button', { name: /Retry/i }))
      await waitForStrategyRetry()
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Create Strategy/i })).toBeInTheDocument()
      
      // Bot Integration retry
      const { waitForLoadingToFinish: waitForBotRetry, user: botRetryUser } = render(<BotIntegration />, { authenticated: true })
      await botRetryUser.click(screen.getByRole('button', { name: /Retry/i }))
      await waitForBotRetry()
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Continue to Wallet Creation/i })).toBeInTheDocument()
      
      // Wallet Creation retry
      const { waitForLoadingToFinish: waitForWalletRetry, user: walletRetryUser } = render(<WalletCreation />, { authenticated: true })
      await walletRetryUser.click(screen.getByRole('button', { name: /Retry/i }))
      await waitForWalletRetry()
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Continue to Key Management/i })).toBeInTheDocument()
      
      // Key Management retry
      const { waitForLoadingToFinish: waitForKeyRetry, user: keyRetryUser } = render(<KeyManagement />, { authenticated: true })
      await keyRetryUser.click(screen.getByRole('button', { name: /Retry/i }))
      await waitForKeyRetry()
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Continue to Dashboard/i })).toBeInTheDocument()
      
      // Test error recovery with multiple retries
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'success' }) })
      
      // Strategy Creation multiple retries
      const { waitForLoadingToFinish: waitForStrategyMultiRetry, user: strategyMultiRetryUser } = render(<StrategyCreation />, { authenticated: true })
      await strategyMultiRetryUser.click(screen.getByRole('button', { name: /Retry/i }))
      await waitForStrategyMultiRetry()
      await strategyMultiRetryUser.click(screen.getByRole('button', { name: /Retry/i }))
      await waitForStrategyMultiRetry()
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Create Strategy/i })).toBeInTheDocument()
      
      // Test error recovery with different error types
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'success' }) })
      
      // Bot Integration error recovery
      const { waitForLoadingToFinish: waitForBotErrorRecovery, user: botErrorRecoveryUser } = render(<BotIntegration />, { authenticated: true })
      await botErrorRecoveryUser.click(screen.getByRole('button', { name: /Retry/i }))
      await waitForBotErrorRecovery()
      await botErrorRecoveryUser.click(screen.getByRole('button', { name: /Retry/i }))
      await waitForBotErrorRecovery()
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Continue to Wallet Creation/i })).toBeInTheDocument()
      
      // Test loading state transitions
      global.fetch = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)))
      
      // Strategy Creation loading transitions
      const { container: strategyLoadingTransitionContainer } = render(<StrategyCreation />, { authenticated: true })
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(strategyLoadingTransitionContainer).toMatchSnapshot('Strategy Creation - Loading State')
      
      // Bot Integration loading transitions
      const { container: botLoadingTransitionContainer } = render(<BotIntegration />, { authenticated: true })
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(botLoadingTransitionContainer).toMatchSnapshot('Bot Integration - Loading State')
      
      // Wallet Creation loading transitions
      const { container: walletLoadingTransitionContainer } = render(<WalletCreation />, { authenticated: true })
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(walletLoadingTransitionContainer).toMatchSnapshot('Wallet Creation - Loading State')
      
      // Key Management loading transitions
      const { container: keyLoadingTransitionContainer } = render(<KeyManagement />, { authenticated: true })
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(keyLoadingTransitionContainer).toMatchSnapshot('Key Management - Loading State')
      
      // Test timeout handling
      jest.useFakeTimers()
      global.fetch = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 5000)))
      
      // Strategy Creation timeout
      const { waitForError: waitForStrategyTimeout } = render(<StrategyCreation />, { authenticated: true })
      jest.advanceTimersByTime(5000)
      await waitForStrategyTimeout('Request timed out')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/timed out/)
      
      // Bot Integration timeout
      const { waitForError: waitForBotTimeout } = render(<BotIntegration />, { authenticated: true })
      jest.advanceTimersByTime(5000)
      await waitForBotTimeout('Request timed out')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/timed out/)
      
      // Wallet Creation timeout
      const { waitForError: waitForWalletTimeout } = render(<WalletCreation />, { authenticated: true })
      jest.advanceTimersByTime(5000)
      await waitForWalletTimeout('Request timed out')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/timed out/)
      
      // Key Management timeout
      const { waitForError: waitForKeyTimeout } = render(<KeyManagement />, { authenticated: true })
      jest.advanceTimersByTime(5000)
      await waitForKeyTimeout('Request timed out')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/timed out/)
      
      jest.useRealTimers()
      
      // Test error boundaries and snapshots
      const { container: errorBoundaryContainer } = render(
        <ErrorBoundary>
          <BotIntegration />
        </ErrorBoundary>,
        { authenticated: true }
      )
      expect(errorBoundaryContainer).toMatchSnapshot('Error Boundary - Bot Integration')
      
      // Test component snapshots in different states
      const { container: strategyContainer } = render(<StrategyCreation />, { authenticated: true })
      expect(strategyContainer).toMatchSnapshot('Strategy Creation - Initial State')
      
      const { container: botContainer } = render(<BotIntegration />, { authenticated: true })
      expect(botContainer).toMatchSnapshot('Bot Integration - Initial State')
      
      const { container: walletContainer } = render(<WalletCreation />, { authenticated: true })
      expect(walletContainer).toMatchSnapshot('Wallet Creation - Initial State')
      
      const { container: keyContainer } = render(<KeyManagement />, { authenticated: true })
      expect(keyContainer).toMatchSnapshot('Key Management - Initial State')
      
      // Test error states snapshots
      global.fetch = jest.fn(() => Promise.reject(new Error('Test error')))
      
      const { container: errorContainer } = render(<StrategyCreation />, { authenticated: true })
      expect(errorContainer).toMatchSnapshot('Strategy Creation - Error State')
      expect(screen.queryByRole('button', { name: /Continue to Dashboard/i })).not.toBeInTheDocument()
      
      // Wallet Creation network error
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))
      const { waitForError: waitForNetworkError } = render(<WalletCreation />, { authenticated: true })
      await waitForNetworkError('Network error')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Network error/)
      expect(screen.getByText(/Wallet Creation/i)).toBeInTheDocument()
      
      // Key Management validation error
      global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Invalid key format' }) }))
      const { waitForError: waitForValidationError } = render(<KeyManagement />, { authenticated: true })
      await waitForValidationError('Invalid key format')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Invalid key format/)
      expect(screen.getByText(/Key Management/i)).toBeInTheDocument()
      
      // Strategy Creation validation error
      global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Invalid strategy parameters' }) }))
      const { waitForError: waitForStrategyValidationError } = render(<StrategyCreation />, { authenticated: true })
      await waitForStrategyValidationError('Invalid strategy parameters')
      expect(screen.getByTestId('error-message')).toHaveTextContent(/Invalid strategy parameters/)
      expect(screen.getByText(/Create Your Strategy/i)).toBeInTheDocument()
      
      // Test retry functionality with exponential backoff
      let retryAttemptCount = 0
      global.fetch = jest.fn(() => {
        retryAttemptCount++
        if (retryAttemptCount <= 2) {
          return Promise.reject(new Error('Temporary failure'))
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
      })
      
      const { waitForLoadingToFinish: waitForRetrySuccess, user: retryWorkflowUser } = render(<BotIntegration />, { authenticated: true })
      const retryButton = screen.getByRole('button', { name: /Retry/i })
      await retryWorkflowUser.click(retryButton)
      await waitForRetrySuccess()
      expect(retryAttemptCount).toBe(3)
      expect(screen.getByRole('button', { name: /Continue to Wallet Creation/i })).toBeInTheDocument()
      
      // Test error boundary recovery for all workflow components
      const workflowComponents = [
        { 
          Component: AgentSelection,
          name: 'Agent Selection',
          expectedText: /Trading Agent/i,
          nextButton: /Continue/i,
          validationError: 'Please select an agent type',
          validationTest: async (user) => {
            const continueButton = screen.getByRole('button', { name: /Continue/i })
            await user.click(continueButton)
            expect(screen.getByText(/Please select an agent type/i)).toBeInTheDocument()
          }
        },
        { 
          Component: StrategyCreation,
          name: 'Strategy Creation',
          expectedText: /Create Strategy/i,
          nextButton: /Save Strategy/i,
          validationError: 'Strategy parameters are required',
          validationTest: async (user) => {
            const saveButton = screen.getByRole('button', { name: /Save Strategy/i })
            await user.click(saveButton)
            expect(screen.getByText(/Strategy parameters are required/i)).toBeInTheDocument()
          }
        },
        { 
          Component: BotIntegration,
          name: 'Bot Integration',
          expectedText: /Bot Integration/i,
          nextButton: /Continue to Wallet/i,
          validationError: 'Bot initialization required',
          validationTest: async (user) => {
            const continueButton = screen.getByRole('button', { name: /Continue to Wallet/i })
            await user.click(continueButton)
            expect(screen.getByText(/Bot initialization required/i)).toBeInTheDocument()
          }
        },
        { 
          Component: WalletCreation,
          name: 'Wallet Creation',
          expectedText: /Wallet Creation/i,
          nextButton: /Continue to Key/i,
          validationError: 'Wallet address is required',
          validationTest: async (user) => {
            const continueButton = screen.getByRole('button', { name: /Continue to Key/i })
            await user.click(continueButton)
            expect(screen.getByText(/Wallet address is required/i)).toBeInTheDocument()
          }
        },
        { 
          Component: KeyManagement,
          name: 'Key Management',
          expectedText: /Key Management/i,
          nextButton: /Finish Setup/i,
          validationError: 'API keys are required',
          validationTest: async (user) => {
            const finishButton = screen.getByRole('button', { name: /Finish Setup/i })
            await user.click(finishButton)
            expect(screen.getByText(/API keys are required/i)).toBeInTheDocument()
          }
        }
      ]
      
      workflowComponents.forEach(({ Component, name, expectedText, nextButton, validationError, validationTest }) => {
        describe(`${name} Component`, () => {
          beforeEach(() => {
            jest.useFakeTimers()
          })

          afterEach(() => {
            jest.useRealTimers()
          })

          it('renders correctly', () => {
            const { container } = render(
              <ErrorBoundary>
                <Component />
              </ErrorBoundary>,
              { authenticated: true }
            )
            expect(screen.getByText(expectedText)).toBeInTheDocument()
            expect(container).toMatchSnapshot(`Error Boundary - ${name}`)
          })

          it('handles validation errors', async () => {
            const { user } = render(
              <ErrorBoundary>
                <Component />
              </ErrorBoundary>,
              { authenticated: true }
            )
            await validationTest(user)
          })

          it('handles network errors and recovery', async () => {
            global.fetch = jest.fn().mockRejectedValueOnce(new Error(`${name} error`))
            const { user } = render(
              <ErrorBoundary>
                <Component />
              </ErrorBoundary>,
              { authenticated: true }
            )
            const continueButton = screen.getByRole('button', { name: nextButton })
            await user.click(continueButton)
            expect(screen.getByTestId('error-message')).toHaveTextContent(`${name} error`)

            global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
            const retryButton = screen.getByRole('button', { name: /Retry/i })
            await user.click(retryButton)
            expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
          })

          it('handles timeout errors', async () => {
            global.fetch = jest.fn().mockImplementationOnce(() => new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Request timeout')), 5000)
            }))
            const { user } = render(
              <ErrorBoundary>
                <Component />
              </ErrorBoundary>,
              { authenticated: true }
            )
            const continueButton = screen.getByRole('button', { name: nextButton })
            await user.click(continueButton)
            jest.advanceTimersByTime(5000)
            expect(screen.getByTestId('error-message')).toHaveTextContent(/timeout/i)
          })
        })
      })
      
      // Test complete workflow error recovery
      const workflowSteps = [
        { 
          Component: AgentSelection,
          name: 'Agent Selection',
          error: 'Agent selection failed',
          recovery: { type: 'trading' },
          nextButton: /Continue/i,
          validation: () => expect(screen.getByText(/Trading Agent/i)).toBeInTheDocument()
        },
        {
          Component: StrategyCreation,
          name: 'Strategy Creation',
          error: 'Strategy creation failed',
          recovery: { strategy: 'test' },
          nextButton: /Save Strategy/i,
          validation: () => expect(screen.getByText(/Create Strategy/i)).toBeInTheDocument()
        },
        {
          Component: BotIntegration,
          name: 'Bot Integration',
          error: 'Bot integration failed',
          recovery: { status: 'ready' },
          nextButton: /Continue to Wallet/i,
          validation: () => expect(screen.getByText(/Bot Integration/i)).toBeInTheDocument()
        },
        {
          Component: WalletCreation,
          name: 'Wallet Creation',
          error: 'Wallet creation failed',
          recovery: { address: 'test-address' },
          nextButton: /Continue to Key/i,
          validation: () => expect(screen.getByText(/Wallet Creation/i)).toBeInTheDocument()
        },
        {
          Component: KeyManagement,
          name: 'Key Management',
          error: 'Key management failed',
          recovery: { keys: ['test-key'] },
          nextButton: /Finish Setup/i,
          validation: () => expect(screen.getByText(/Key Management/i)).toBeInTheDocument()
        }
      ]
      
      describe('Bot Integration Page', () => {
        it('handles initialization errors', async () => {
          global.fetch = jest.fn().mockRejectedValueOnce(new Error('Failed to initialize bot'))
          const { user } = render(<BotIntegration />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to initialize bot/)
          })
          expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
        })

        it('handles successful bot initialization', async () => {
          global.fetch = jest.fn().mockResolvedValueOnce({ 
            ok: true, 
            json: () => Promise.resolve({ status: 'ready' }) 
          })
          const { user } = render(<BotIntegration />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByRole('button', { name: /Continue to Wallet Creation/i })).toBeInTheDocument()
          })
        })

        it('handles network timeouts', async () => {
          jest.useFakeTimers()
          global.fetch = jest.fn().mockImplementationOnce(() => new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Network timeout')), 5000)
          }))
          const { user } = render(<BotIntegration />, { authenticated: true })
          jest.advanceTimersByTime(5000)
          await waitFor(() => {
            expect(screen.getByTestId('error-message')).toHaveTextContent(/Network timeout/)
          })
          jest.useRealTimers()
        })

        it('handles unauthorized access', async () => {
          global.fetch = jest.fn().mockResolvedValueOnce({ 
            ok: false, 
            status: 401,
            json: () => Promise.resolve({ message: 'Unauthorized' }) 
          })
          const { mockRouter } = render(<BotIntegration />, { authenticated: false })
          await waitFor(() => {
            expect(mockRouter.push).toHaveBeenCalledWith('/')
          })
        })
      })

      describe('Wallet Creation Page', () => {
        beforeEach(() => {
          jest.useFakeTimers()
        })

        afterEach(() => {
          jest.useRealTimers()
          jest.clearAllMocks()
        })

        it('handles successful wallet creation', async () => {
          const mockWalletAddress = 'test-wallet-address'
          global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ address: mockWalletAddress, status: 'success' })
          })

          const { user, mockRouter } = render(<WalletCreation />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByText(mockWalletAddress)).toBeInTheDocument()
          })
          const continueButton = screen.getByRole('button', { name: /Continue to Key/i })
          await user.click(continueButton)
          expect(mockRouter.push).toHaveBeenCalledWith('/key-management?type=trading')
        })

        it('handles wallet creation failure', async () => {
          global.fetch = jest.fn().mockRejectedValueOnce(new Error('Failed to create wallet'))
          const { user } = render(<WalletCreation />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to create wallet/)
          })
          expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
        })

        it('handles network timeout during wallet creation', async () => {
          global.fetch = jest.fn().mockImplementationOnce(() => new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Network timeout')), 5000)
          }))
          const { user } = render(<WalletCreation />, { authenticated: true })
          jest.advanceTimersByTime(5000)
          await waitFor(() => {
            expect(screen.getByTestId('error-message')).toHaveTextContent(/Network timeout/)
          })
        })

        it('handles unauthorized access', async () => {
          global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ message: 'Unauthorized' })
          })
          const { mockRouter } = render(<WalletCreation />, { authenticated: false })
          await waitFor(() => {
            expect(mockRouter.push).toHaveBeenCalledWith('/')
          })
        })

        it('displays wallet address securely', async () => {
          const mockWalletAddress = 'test-wallet-address'
          const mockPrivateKey = 'test-private-key'
          global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ 
              address: mockWalletAddress, 
              privateKey: mockPrivateKey,
              status: 'success' 
            })
          })

          render(<WalletCreation />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByText(mockWalletAddress)).toBeInTheDocument()
            expect(screen.getByText(mockPrivateKey)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /Copy Private Key/i })).toBeInTheDocument()
          })
        })
      })

      describe('Key Management Page', () => {
        beforeEach(() => {
          jest.useFakeTimers()
        })

        afterEach(() => {
          jest.useRealTimers()
          jest.clearAllMocks()
        })

        it('handles successful key management setup', async () => {
          const mockApiKeys = ['test-api-key-1', 'test-api-key-2']
          global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ keys: mockApiKeys, status: 'success' })
          })

          const { user, mockRouter } = render(<KeyManagement />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByText(mockApiKeys[0])).toBeInTheDocument()
            expect(screen.getByText(mockApiKeys[1])).toBeInTheDocument()
          })
          const finishButton = screen.getByRole('button', { name: /Finish Setup/i })
          await user.click(finishButton)
          expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
        })

        it('handles key validation errors', async () => {
          global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ message: 'Invalid API keys' })
          })

          const { user } = render(<KeyManagement />, { authenticated: true })
          const finishButton = screen.getByRole('button', { name: /Finish Setup/i })
          await user.click(finishButton)
          expect(screen.getByTestId('error-message')).toHaveTextContent(/Invalid API keys/)
        })

        it('handles key generation failure', async () => {
          global.fetch = jest.fn().mockRejectedValueOnce(new Error('Failed to generate keys'))
          const { user } = render(<KeyManagement />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByTestId('error-message')).toHaveTextContent(/Failed to generate keys/)
          })
          expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
        })

        it('handles secure key display', async () => {
          const mockApiKey = 'test-api-key'
          const mockSecretKey = 'test-secret-key'
          global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ 
              apiKey: mockApiKey,
              secretKey: mockSecretKey,
              status: 'success' 
            })
          })

          const { user } = render(<KeyManagement />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByText(mockApiKey)).toBeInTheDocument()
            expect(screen.getByText(mockSecretKey)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /Copy Keys/i })).toBeInTheDocument()
          })

          const copyButton = screen.getByRole('button', { name: /Copy Keys/i })
          await user.click(copyButton)
          expect(screen.getByText(/Keys copied/i)).toBeInTheDocument()
        })

        it('handles key revocation', async () => {
          global.fetch = jest.fn()
            .mockResolvedValueOnce({
              ok: true,
              json: () => Promise.resolve({ keys: ['old-key'], status: 'success' })
            })
            .mockResolvedValueOnce({
              ok: true,
              json: () => Promise.resolve({ status: 'revoked' })
            })
            .mockResolvedValueOnce({
              ok: true,
              json: () => Promise.resolve({ keys: ['new-key'], status: 'success' })
            })

          const { user } = render(<KeyManagement />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByText('old-key')).toBeInTheDocument()
          })

          const revokeButton = screen.getByRole('button', { name: /Revoke Keys/i })
          await user.click(revokeButton)
          await waitFor(() => {
            expect(screen.getByText('new-key')).toBeInTheDocument()
          })
        })
      })

      describe('Complete Trading Workflow', () => {
        it('completes full workflow successfully', async () => {
          const mockResponses = {
            agentSelection: { type: 'trading', status: 'success' },
            strategyCreation: { strategy: 'test-strategy', status: 'success' },
            botIntegration: { status: 'ready' },
            walletCreation: { address: 'test-wallet-address', status: 'success' },
            keyManagement: { keys: ['test-api-key'], status: 'success' }
          }

          global.fetch = jest.fn().mockImplementation((url) => {
            if (url.includes('agent')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockResponses.agentSelection) })
            if (url.includes('strategy')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockResponses.strategyCreation) })
            if (url.includes('bot')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockResponses.botIntegration) })
            if (url.includes('wallet')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockResponses.walletCreation) })
            if (url.includes('keys')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockResponses.keyManagement) })
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
          })

          const { user, mockRouter } = render(<AgentSelection />, { authenticated: true })
          
          // Complete agent selection
          const agentButton = screen.getByRole('button', { name: /Trading Agent/i })
          await user.click(agentButton)
          const continueButton = screen.getByRole('button', { name: /Continue/i })
          await user.click(continueButton)
          expect(mockRouter.push).toHaveBeenCalledWith('/strategy-creation?type=trading')

          // Complete strategy creation
          render(<StrategyCreation />, { authenticated: true })
          const strategyInput = screen.getByRole('textbox', { name: /Strategy/i })
          await user.type(strategyInput, 'test-strategy')
          const saveButton = screen.getByRole('button', { name: /Save Strategy/i })
          await user.click(saveButton)
          expect(mockRouter.push).toHaveBeenCalledWith('/bot-integration?type=trading')

          // Complete bot integration
          render(<BotIntegration />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByRole('button', { name: /Continue to Wallet/i })).toBeInTheDocument()
          })
          const botContinueButton = screen.getByRole('button', { name: /Continue to Wallet/i })
          await user.click(botContinueButton)
          expect(mockRouter.push).toHaveBeenCalledWith('/wallet-creation?type=trading')

          // Complete wallet creation
          render(<WalletCreation />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByText(/test-wallet-address/i)).toBeInTheDocument()
          })
          const walletContinueButton = screen.getByRole('button', { name: /Continue to Key/i })
          await user.click(walletContinueButton)
          expect(mockRouter.push).toHaveBeenCalledWith('/key-management?type=trading')

          // Complete key management
          render(<KeyManagement />, { authenticated: true })
          await waitFor(() => {
            expect(screen.getByText(/test-api-key/i)).toBeInTheDocument()
          })
          const finishButton = screen.getByRole('button', { name: /Finish Setup/i })
          await user.click(finishButton)
          expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
        })
      })

      for (const { Component, name, error, recovery, nextButton, validation } of workflowSteps) {
        describe(`${name} Component`, () => {
          beforeEach(() => {
            jest.useFakeTimers()
          })

          afterEach(() => {
            jest.useRealTimers()
            jest.clearAllMocks()
          })

          it('renders correctly and handles validation', async () => {
            const { container, user } = render(
              <ErrorBoundary>
                <Component />
              </ErrorBoundary>,
              { authenticated: true }
            )
            expect(container).toMatchSnapshot(`${name} - Initial Render`)
            await validation(user)
          })

          it('handles successful submission', async () => {
            global.fetch = jest.fn().mockResolvedValueOnce({ 
              ok: true, 
              json: () => Promise.resolve(recovery) 
            })
            
            const { waitForLoadingToFinish, user } = render(
              <ErrorBoundary>
                <Component />
              </ErrorBoundary>,
              { authenticated: true }
            )
            
            const continueButton = screen.getByRole('button', { name: nextButton })
            await user.click(continueButton)
            await waitForLoadingToFinish()
            expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
          })

          it('handles error and recovery', async () => {
            global.fetch = jest.fn()
              .mockRejectedValueOnce(new Error(error))
              .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(recovery) })
            
            const { waitForLoadingToFinish, user } = render(
              <ErrorBoundary>
                <Component />
              </ErrorBoundary>,
              { authenticated: true }
            )
            
            const continueButton = screen.getByRole('button', { name: nextButton })
            await user.click(continueButton)
            expect(screen.getByTestId('error-message')).toHaveTextContent(error)
            expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
            
            const retryButton = screen.getByRole('button', { name: /Retry/i })
            await user.click(retryButton)
            await waitForLoadingToFinish()
            expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
          })

          it('handles network timeout', async () => {
            global.fetch = jest.fn()
              .mockImplementationOnce(() => new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Network timeout')), 5000)
              }))
              .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(recovery) })
            
            const { waitForLoadingToFinish, user } = render(
              <ErrorBoundary>
                <Component />
              </ErrorBoundary>,
              { authenticated: true }
            )
            
            const continueButton = screen.getByRole('button', { name: nextButton })
            await user.click(continueButton)
            
            jest.advanceTimersByTime(5000)
            expect(screen.getByTestId('error-message')).toHaveTextContent(/Network timeout/)
            expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
            
            const retryButton = screen.getByRole('button', { name: /Retry/i })
            await user.click(retryButton)
            await waitForLoadingToFinish()
            expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
          })

          it('handles server error', async () => {
            global.fetch = jest.fn().mockResolvedValueOnce({ 
              ok: false,
              status: 500,
              statusText: 'Internal Server Error',
              json: () => Promise.resolve({ message: 'Server error' })
            })
            
            const { user } = render(
              <ErrorBoundary>
                <Component />
              </ErrorBoundary>,
              { authenticated: true }
            )
            
            const continueButton = screen.getByRole('button', { name: nextButton })
            await user.click(continueButton)
            expect(screen.getByTestId('error-message')).toHaveTextContent(/Server error/)
          })

          it('handles unauthorized access', async () => {
            global.fetch = jest.fn().mockResolvedValueOnce({ 
              ok: false,
              status: 401,
              statusText: 'Unauthorized',
              json: () => Promise.resolve({ message: 'Unauthorized access' })
            })
            
            const { mockRouter, user } = render(
              <ErrorBoundary>
                <Component />
              </ErrorBoundary>,
              { authenticated: false }
            )
            
            const continueButton = screen.getByRole('button', { name: nextButton })
            await user.click(continueButton)
            expect(mockRouter.push).toHaveBeenCalledWith('/')
          })
        })
      }
      
      jest.useRealTimers()
    })
  })
})
