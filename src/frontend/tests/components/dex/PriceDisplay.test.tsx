import React from 'react';
import {
  render,
  screen,
  waitFor,
  mockConsoleError
} from '../../utils/test-utils';
import PriceDisplay from '../../../components/dex/PriceDisplay';

// Mock console.error
mockConsoleError();

describe('PriceDisplay', () => {
  it('renders loading state correctly', () => {
    render(
      <PriceDisplay
        baseToken="SOL"
        quoteToken="USDC"
        isLoading={true}
      />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays placeholder when tokens are not selected', () => {
    render(<PriceDisplay />);
    expect(screen.getByText('Select tokens to view price')).toBeInTheDocument();
  });

  it('displays price information correctly', () => {
    const props = {
      baseToken: 'SOL',
      quoteToken: 'USDC',
      price: 100.50,
      priceChange: 2.5
    };

    render(<PriceDisplay {...props} />);
    
    // Check token pair
    expect(screen.getByText('SOL/USDC')).toBeInTheDocument();
    
    // Check price
    expect(screen.getByText('100.50')).toBeInTheDocument();
    
    // Check price change
    expect(screen.getByText('+2.50%')).toBeInTheDocument();
  });

  it('formats price with correct decimal places', () => {
    const props = {
      baseToken: 'SOL',
      quoteToken: 'USDC',
      price: 100.123456789,
      priceChange: 2.5
    };

    render(<PriceDisplay {...props} />);
    expect(screen.getByText('100.123457')).toBeInTheDocument();
  });

  it('displays negative price change correctly', () => {
    const props = {
      baseToken: 'SOL',
      quoteToken: 'USDC',
      price: 100,
      priceChange: -2.5
    };

    render(<PriceDisplay {...props} />);
    expect(screen.getByText('-2.50%')).toBeInTheDocument();
  });

  it('applies correct color classes for positive price change', () => {
    const props = {
      baseToken: 'SOL',
      quoteToken: 'USDC',
      price: 100,
      priceChange: 2.5
    };

    render(<PriceDisplay {...props} />);
    const priceChangeElement = screen.getByText('+2.50%');
    expect(priceChangeElement).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('applies correct color classes for negative price change', () => {
    const props = {
      baseToken: 'SOL',
      quoteToken: 'USDC',
      price: 100,
      priceChange: -2.5
    };

    render(<PriceDisplay {...props} />);
    const priceChangeElement = screen.getByText('-2.50%');
    expect(priceChangeElement).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('displays price without price change when not provided', () => {
    const props = {
      baseToken: 'SOL',
      quoteToken: 'USDC',
      price: 100
    };

    render(<PriceDisplay {...props} />);
    expect(screen.getByText('100.00')).toBeInTheDocument();
    expect(screen.queryByText(/[+-]\d+\.\d+%/)).not.toBeInTheDocument();
  });

  it('handles custom className prop', () => {
    const props = {
      baseToken: 'SOL',
      quoteToken: 'USDC',
      price: 100,
      className: 'custom-class'
    };

    const { container } = render(<PriceDisplay {...props} />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('shows fees information tooltip', () => {
    const props = {
      baseToken: 'SOL',
      quoteToken: 'USDC',
      price: 100
    };

    render(<PriceDisplay {...props} />);
    expect(screen.getByText('Price includes all fees')).toBeInTheDocument();
  });

  it('transitions from loading to loaded state', async () => {
    const { rerender } = render(
      <PriceDisplay
        baseToken="SOL"
        quoteToken="USDC"
        isLoading={true}
      />
    );

    // Initially loading
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Update to loaded state
    rerender(
      <PriceDisplay
        baseToken="SOL"
        quoteToken="USDC"
        price={100}
        isLoading={false}
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByText('100.00')).toBeInTheDocument();
    });
  });
});
