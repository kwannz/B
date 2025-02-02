import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  generateMockToken,
  mockConsoleError,
  waitForLoadingToFinish
} from '../../utils/test-utils';
import SwapInterface from '../../../components/dex/SwapInterface';

// Mock tokens
const mockSolToken = generateMockToken();
const mockUsdcToken = generateMockToken({
  address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
});

// Mock console.error
mockConsoleError();

describe('SwapInterface', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders without crashing', () => {
    render(<SwapInterface />);
    expect(screen.getByText('Select Tokens')).toBeInTheDocument();
  });

  it('shows token selectors', () => {
    render(<SwapInterface />);
    expect(screen.getAllByText('Select Token')).toHaveLength(2);
  });

  it('disables input when no token is selected', () => {
    render(<SwapInterface />);
    const input = screen.getByPlaceholderText('0.0');
    expect(input).toBeDisabled();
  });

  it('enables input when tokens are selected', async () => {
    render(<SwapInterface />);
    
    // Open token selector
    const [fromSelector] = screen.getAllByText('Select Token');
    fireEvent.click(fromSelector);

    // Select a token
    const tokenButton = await screen.findByText('SOL');
    fireEvent.click(tokenButton);

    // Check if input is enabled
    const input = screen.getByPlaceholderText('0.0');
    expect(input).toBeEnabled();
  });

  it('updates price when amount changes', async () => {
    render(<SwapInterface />);

    // Select tokens
    const [fromSelector, toSelector] = screen.getAllByText('Select Token');
    
    // Select from token
    fireEvent.click(fromSelector);
    const solButton = await screen.findByText('SOL');
    fireEvent.click(solButton);

    // Select to token
    fireEvent.click(toSelector);
    const usdcButton = await screen.findByText('USDC');
    fireEvent.click(usdcButton);

    // Enter amount
    const input = screen.getByPlaceholderText('0.0');
    fireEvent.change(input, { target: { value: '1' } });

    // Wait for price update
    await waitFor(() => {
      expect(screen.getByText(/SOL\/USDC/)).toBeInTheDocument();
    });
  });

  it('handles token swap button', async () => {
    render(<SwapInterface />);

    // Select initial tokens
    const [fromSelector, toSelector] = screen.getAllByText('Select Token');
    
    // Select from token
    fireEvent.click(fromSelector);
    const solButton = await screen.findByText('SOL');
    fireEvent.click(solButton);

    // Select to token
    fireEvent.click(toSelector);
    const usdcButton = await screen.findByText('USDC');
    fireEvent.click(usdcButton);

    // Enter amount
    const input = screen.getByPlaceholderText('0.0');
    fireEvent.change(input, { target: { value: '1' } });

    // Wait for loading to finish
    await waitForLoadingToFinish();

    // Click swap button
    const swapButton = screen.getByRole('button', { name: /swap/i });
    fireEvent.click(swapButton);

    // Verify tokens were swapped
    await waitFor(() => {
      expect(screen.getByText(/USDC\/SOL/)).toBeInTheDocument();
    });
  });

  it('shows error message when price fetch fails', async () => {
    render(<SwapInterface />);

    // Select tokens and trigger error
    const [fromSelector, toSelector] = screen.getAllByText('Select Token');
    
    fireEvent.click(fromSelector);
    const solButton = await screen.findByText('SOL');
    fireEvent.click(solButton);

    fireEvent.click(toSelector);
    const usdcButton = await screen.findByText('USDC');
    fireEvent.click(usdcButton);

    const input = screen.getByPlaceholderText('0.0');
    fireEvent.change(input, { target: { value: '999999999' } }); // Trigger error

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch price/)).toBeInTheDocument();
    });
  });

  it('disables swap button during loading', async () => {
    render(<SwapInterface />);

    // Select tokens
    const [fromSelector, toSelector] = screen.getAllByText('Select Token');
    
    fireEvent.click(fromSelector);
    const solButton = await screen.findByText('SOL');
    fireEvent.click(solButton);

    fireEvent.click(toSelector);
    const usdcButton = await screen.findByText('USDC');
    fireEvent.click(usdcButton);

    // Enter amount
    const input = screen.getByPlaceholderText('0.0');
    fireEvent.change(input, { target: { value: '1' } });

    // Check swap button state during loading
    const swapButton = screen.getByRole('button', { name: /swap/i });
    expect(swapButton).toBeDisabled();

    // Wait for loading to complete
    await waitForLoadingToFinish();
    await waitFor(() => {
      expect(swapButton).toBeEnabled();
    });
  });
});
