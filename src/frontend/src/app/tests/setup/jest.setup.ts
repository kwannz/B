import '@testing-library/jest-dom';
import { jest, expect } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
import { configure } from '@testing-library/react';
import React from 'react';
import type { TestMetrics } from '../types/test.types';

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

global.React = React;
global.jest = jest;
global.expect = expect;

configure({ testIdAttribute: 'data-testid' });

Object.defineProperty(global, 'TextEncoder', { value: TextEncoder });
Object.defineProperty(global, 'TextDecoder', { value: TextDecoder });

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
    const pass = Math.abs(received.performance.errorRate - rate) < 0.001;
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

expect.extend({
  toHaveErrorRate(received: any, expected: number) {
    const pass = Math.abs(received.performance.errorRate - expected) < 0.01;
    return {
      message: () => `expected error rate ${expected} but got ${received.performance.errorRate}`,
      pass
    };
  },
  toHaveLatency(received: any, expected: number) {
    const pass = received.performance.apiLatency <= expected;
    return {
      message: () => `expected latency <= ${expected}ms but got ${received.performance.apiLatency}ms`,
      pass
    };
  },
  toHaveWalletBalance(received: any, expected: number) {
    const pass = Math.abs(received.performance.walletBalance - expected) < 0.0001;
    return {
      message: () => `expected wallet balance ${expected} but got ${received.performance.walletBalance}`,
      pass
    };
  }
});

jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: jest.fn(() => ({
    connected: true,
    connecting: false,
    publicKey: { toString: () => '5KKsb6RFwmVEgtg4HQY8gguARGwGKyYaCeT8DLvBwfKK' },
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
  updateBotStatus: jest.fn(),
  transferSOL: jest.fn(),
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.matchMedia = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.resetModules();
});
