import React, { ReactElement } from 'react';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

interface ProvidersProps {
  children: React.ReactNode;
}

// 创建一个包含所有必要providers的wrapper
function AllTheProviders({ children }: ProvidersProps) {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
}

// 自定义render方法
function customRender(ui: ReactElement, options = {}) {
  return {
    ...rtlRender(ui, { wrapper: AllTheProviders, ...options }),
    user: userEvent.setup()
  };
}

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface MockStorage {
  [key: string]: string;
}

// 测试工具导出
export {
  screen,
  fireEvent,
  waitFor,
  userEvent,
  customRender as render
};

// 测试数据生成器
export const generateMockToken = (overrides = {}): Token => ({
  address: "So11111111111111111111111111111111111111112",
  symbol: "SOL",
  name: "Solana",
  decimals: 9,
  logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  ...overrides
});

export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

export const generateMockApiResponse = <T,>(data: T) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});

export const generateMockErrorResponse = (status = 400, message = 'Error') => ({
  response: {
    data: { message },
    status,
  },
});

export const mockConsoleError = () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  
  afterAll(() => {
    console.error = originalError;
  });
};

export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.IntersectionObserver = mockIntersectionObserver;
};

export const mockResizeObserver = () => {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.ResizeObserver = mockResizeObserver;
};

export const mockLocalStorage = () => {
  const mockStorage: MockStorage = {};
  
  const localStorageMock = {
    getItem: (key: string): string | null => mockStorage[key] || null,
    setItem: (key: string, value: string): void => {
      mockStorage[key] = value.toString();
    },
    removeItem: (key: string): void => {
      delete mockStorage[key];
    },
    clear: (): void => {
      Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    },
  };
  
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });
  
  return mockStorage;
};
