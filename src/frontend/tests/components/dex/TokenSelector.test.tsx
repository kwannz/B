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
import TokenSelector from '../../../components/dex/TokenSelector';

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

describe('TokenSelector', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<TokenSelector onSelect={mockOnSelect} />);
    expect(screen.getByText('Select Token')).toBeInTheDocument();
  });

  it('displays selected token when provided', () => {
    render(
      <TokenSelector
        selectedToken={mockSolToken}
        onSelect={mockOnSelect}
      />
    );
    expect(screen.getByText('SOL')).toBeInTheDocument();
  });

  it('opens token selection modal on click', () => {
    render(<TokenSelector onSelect={mockOnSelect} />);
    fireEvent.click(screen.getByText('Select Token'));
    expect(screen.getByText('Select Token')).toBeInTheDocument(); // Modal title
  });

  it('allows searching for tokens', async () => {
    render(<TokenSelector onSelect={mockOnSelect} />);
    
    // Open modal
    fireEvent.click(screen.getByText('Select Token'));
    
    // Find search input
    const searchInput = screen.getByPlaceholderText('Search by name or paste address');
    fireEvent.change(searchInput, { target: { value: 'SOL' } });

    // Wait for search results
    await waitForLoadingToFinish();
    
    expect(screen.getByText('SOL')).toBeInTheDocument();
  });

  it('calls onSelect when a token is selected', async () => {
    render(<TokenSelector onSelect={mockOnSelect} />);
    
    // Open modal
    fireEvent.click(screen.getByText('Select Token'));
    
    // Wait for tokens to load
    await waitForLoadingToFinish();
    
    // Select SOL token
    fireEvent.click(screen.getByText('SOL'));
    
    expect(mockOnSelect).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'SOL',
      name: 'Solana'
    }));
  });

  it('displays loading state while fetching tokens', async () => {
    render(<TokenSelector onSelect={mockOnSelect} />);
    
    // Open modal
    fireEvent.click(screen.getByText('Select Token'));
    
    // Search to trigger loading
    const searchInput = screen.getByPlaceholderText('Search by name or paste address');
    fireEvent.change(searchInput, { target: { value: 'SOL' } });
    
    // Check for loading indicator
    expect(screen.getByText('Loading tokens...')).toBeInTheDocument();
    
    // Wait for loading to finish
    await waitForLoadingToFinish();
    
    // Loading indicator should be gone
    expect(screen.queryByText('Loading tokens...')).not.toBeInTheDocument();
  });

  it('shows no results message when no tokens found', async () => {
    render(<TokenSelector onSelect={mockOnSelect} />);
    
    // Open modal
    fireEvent.click(screen.getByText('Select Token'));
    
    // Search for non-existent token
    const searchInput = screen.getByPlaceholderText('Search by name or paste address');
    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });
    
    // Wait for search to complete
    await waitForLoadingToFinish();
    
    expect(screen.getByText('No tokens found')).toBeInTheDocument();
  });

  it('disables the selector when disabled prop is true', () => {
    render(
      <TokenSelector
        onSelect={mockOnSelect}
        disabled={true}
      />
    );
    
    const selector = screen.getByText('Select Token').closest('button');
    expect(selector).toBeDisabled();
  });

  it('displays token logo when available', () => {
    render(
      <TokenSelector
        selectedToken={mockSolToken}
        onSelect={mockOnSelect}
      />
    );
    
    const logo = screen.getByAltText('SOL') as HTMLImageElement;
    expect(logo.src).toBe(mockSolToken.logoURI);
  });

  it('closes modal when clicking outside', async () => {
    render(<TokenSelector onSelect={mockOnSelect} />);
    
    // Open modal
    fireEvent.click(screen.getByText('Select Token'));
    
    // Click backdrop to close
    const backdrop = screen.getByRole('presentation');
    fireEvent.click(backdrop);
    
    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByText('Select Token')).toHaveLength(1); // Only button text remains
    });
  });
});
