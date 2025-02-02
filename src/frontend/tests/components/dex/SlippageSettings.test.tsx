import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  mockConsoleError
} from '../../utils/test-utils';
import SlippageSettings from '../../../components/dex/SlippageSettings';

// Mock console.error
mockConsoleError();

describe('SlippageSettings', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default value', () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    const button = screen.getByText('0.5%');
    expect(button).toHaveClass('bg-primary');
  });

  it('allows selecting preset values', () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    
    // Click on 1.0% button
    fireEvent.click(screen.getByText('1.0%'));
    
    expect(mockOnChange).toHaveBeenCalledWith(1.0);
    expect(screen.getByText('1.0%')).toHaveClass('bg-primary');
  });

  it('handles custom value input', () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Custom');
    fireEvent.change(input, { target: { value: '2.5' } });
    
    expect(mockOnChange).toHaveBeenCalledWith(2.5);
  });

  it('shows error for invalid custom value', () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Custom');
    fireEvent.change(input, { target: { value: '-1' } });
    
    expect(screen.getByText('Slippage must be greater than 0%')).toBeInTheDocument();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('shows error for excessive slippage', () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Custom');
    fireEvent.change(input, { target: { value: '51' } });
    
    expect(screen.getByText('Slippage cannot exceed 50%')).toBeInTheDocument();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('shows warning for high slippage', () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Custom');
    fireEvent.change(input, { target: { value: '3.5' } });
    
    expect(screen.getByText(/High slippage tolerance/)).toBeInTheDocument();
    expect(screen.getByText(/front-run/)).toBeInTheDocument();
  });

  it('clears custom value when selecting preset', () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    
    // First enter custom value
    const input = screen.getByPlaceholderText('Custom');
    fireEvent.change(input, { target: { value: '2.5' } });
    
    // Then click preset
    fireEvent.click(screen.getByText('0.5%'));
    
    expect(input).toHaveValue('');
    expect(mockOnChange).toHaveBeenLastCalledWith(0.5);
  });

  it('accepts custom defaultValue prop', () => {
    render(<SlippageSettings defaultValue={1.0} onChange={mockOnChange} />);
    expect(screen.getByText('1.0%')).toHaveClass('bg-primary');
  });

  it('handles className prop', () => {
    const { container } = render(
      <SlippageSettings
        onChange={mockOnChange}
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('displays info tooltip', () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    expect(screen.getByText(/Your transaction will revert/)).toBeInTheDocument();
  });

  it('validates numeric input only', () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Custom');
    fireEvent.change(input, { target: { value: 'abc' } });
    
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('handles floating point values correctly', () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Custom');
    fireEvent.change(input, { target: { value: '1.23' } });
    
    expect(mockOnChange).toHaveBeenCalledWith(1.23);
  });

  it('clears error when input becomes valid', async () => {
    render(<SlippageSettings onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Custom');
    
    // First enter invalid value
    fireEvent.change(input, { target: { value: '-1' } });
    expect(screen.getByText('Slippage must be greater than 0%')).toBeInTheDocument();
    
    // Then enter valid value
    fireEvent.change(input, { target: { value: '1' } });
    await waitFor(() => {
      expect(screen.queryByText('Slippage must be greater than 0%')).not.toBeInTheDocument();
    });
  });
});
