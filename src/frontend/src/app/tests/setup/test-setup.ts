import '@testing-library/jest-dom';
import { jest, expect } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
import { configure } from '@testing-library/react';
import React from 'react';
import type { TestMetrics } from '../types/test.types';

declare global {
  var expect: jest.Expect;
  var jest: typeof jest;
  var React: typeof React;
  namespace jest {
    interface Matchers<R> {
      toHaveMetric(metricName: string, value: number): R;
      toHaveErrorRate(rate: number): R;
      toHaveLatency(milliseconds: number): R;
      toHaveSuccessRate(rate: number): R;
      toHaveTradeCount(count: number): R;
      toHaveWalletBalance(balance: number): R;
    }
  }
}

global.React = React;
global.jest = jest;
global.expect = expect;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveMetric(metricName: string, value: number): R;
      toHaveErrorRate(rate: number): R;
      toHaveLatency(milliseconds: number): R;
      toHaveSuccessRate(rate: number): R;
      toHaveTradeCount(count: number): R;
      toHaveWalletBalance(balance: number): R;
    }
  }
}

expect.extend({
  toHaveMetric(received: TestMetrics, metricName: string, value: number) {
    const metrics = received.performance;
    const pass = metrics[metricName as keyof typeof metrics] === value;
    return {
      message: () => `expected metrics to ${pass ? 'not ' : ''}have ${metricName}=${value}`,
      pass
    };
  },
  toHaveErrorRate(received: TestMetrics, rate: number) {
    const pass = received.performance.errorRate === rate;
    return {
      message: () => `expected error rate to be ${rate} but got ${received.performance.errorRate}`,
      pass
    };
  },
  toHaveLatency(received: TestMetrics, milliseconds: number) {
    const pass = received.performance.apiLatency <= milliseconds;
    return {
      message: () => `expected API latency to be <= ${milliseconds}ms but got ${received.performance.apiLatency}ms`,
      pass
    };
  },
  toHaveSuccessRate(received: TestMetrics, rate: number) {
    const pass = Math.abs(received.performance.successRate - rate) < 0.001;
    return {
      message: () => `expected success rate to be ${rate} but got ${received.performance.successRate}`,
      pass
    };
  },
  toHaveTradeCount(received: TestMetrics, count: number) {
    const pass = received.performance.totalTrades === count;
    return {
      message: () => `expected total trades to be ${count} but got ${received.performance.totalTrades}`,
      pass
    };
  },
  toHaveWalletBalance(received: TestMetrics, balance: number) {
    const pass = Math.abs(received.performance.walletBalance - balance) < 0.000001;
    return {
      message: () => `expected wallet balance to be ${balance} SOL but got ${received.performance.walletBalance} SOL`,
      pass
    };
  }
});

configure({
  testIdAttribute: 'data-testid',
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: jest.fn(() => ({
    connected: false,
    connecting: false,
    publicKey: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn(),
  })),
  WalletProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

jest.mock('@/app/api/client', () => ({
  createWallet: jest.fn(),
  getWallet: jest.fn(),
  listWallets: jest.fn(),
  createBot: jest.fn(),
  getBotStatus: jest.fn(),
  transferSOL: jest.fn(),
  updateBotStatus: jest.fn(),
  getMetrics: jest.fn(),
  updateMetrics: jest.fn(),
  getDebugInfo: jest.fn(),
  updateDebugConfig: jest.fn(),
}));

jest.mock('zustand', () => ({
  create: jest.fn((fn) => fn(() => ({}))),
  createStore: jest.fn((fn) => fn(() => ({}))),
  persist: {
    persist: jest.fn(),
    createJSONStorage: jest.fn(),
  },
}));

jest.mock('@thirdweb-dev/react', () => ({
  useAddress: jest.fn(),
  useContract: jest.fn(),
  useConnectionStatus: jest.fn(),
  useBalance: jest.fn(),
  useSDK: jest.fn(),
  useNetwork: jest.fn(),
  useSigner: jest.fn(),
  ThirdwebProvider: ({ children }: { children: React.ReactNode }) => children,
}));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  jest.resetModules();
  localStorage.clear();
});
