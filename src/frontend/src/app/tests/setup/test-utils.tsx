import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { DebugMetricsProvider } from '../../providers/DebugMetricsProvider';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => (
  <DebugMetricsProvider>{children}</DebugMetricsProvider>
);

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
