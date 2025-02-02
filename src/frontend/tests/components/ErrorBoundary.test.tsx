import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../../components/common/ErrorBoundary';

// Mock component that throws an error
const ThrowError = () => {
  throw new Error('Config Error: Trading environment validation failed');
};

describe('ErrorBoundary', () => {
  // Prevent console.error from cluttering test output
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Test Child</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders error UI when there is an error', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByText('Config Error: Trading environment validation failed')).toBeInTheDocument();
  });
}); 