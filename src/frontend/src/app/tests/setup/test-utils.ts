import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { DebugMetricsProvider } from '../../providers/DebugMetricsProvider';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <DebugMetricsProvider>
      {children}
    </DebugMetricsProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
