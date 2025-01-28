import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach, afterAll } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';
import { Buffer } from 'buffer';
import { cleanup } from '@testing-library/react';
import { act } from '@testing-library/react';

// Extend expect matchers
expect.extend({
  toHaveBeenCalledWithMatch(received, ...expected) {
    const pass = received.mock.calls.some(call =>
      expected.every((arg, i) => {
        if (typeof arg === 'object') {
          return expect.objectContaining(arg).asymmetricMatch(call[i]);
        }
        return arg === call[i];
      })
    );
    return {
      pass,
      message: () => `expected ${received.mock.calls} to match ${expected}`,
    };
  },
});

// Polyfill TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Polyfill Buffer
global.Buffer = Buffer;

// Mock crypto.getRandomValues
const cryptoMock = {
  getRandomValues: (arr: Uint8Array) => arr.map(() => Math.floor(Math.random() * 256)),
  subtle: {
    digest: vi.fn(),
  },
};
Object.defineProperty(window, 'crypto', { value: cryptoMock });

// Mock WebSocket
class WebSocketMock {
  onopen: () => void = () => {};
  onclose: () => void = () => {};
  onmessage: (data: any) => void = () => {};
  onerror: () => void = () => {};
  send = vi.fn();
  close = vi.fn();
  constructor(url: string) {}
}
global.WebSocket = WebSocketMock as any;

// Mock fetch with default implementation
global.fetch = vi.fn((url: string) => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    headers: new Headers(),
    status: 200,
    statusText: "OK",
  })
);

// Mock localStorage with persistent storage
const store: { [key: string]: string } = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value.toString();
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach(key => delete store[key]);
  }),
  length: 0,
  key: vi.fn((index: number) => Object.keys(store)[index] || null),
};
Object.defineProperty(window, 'localStorage', { 
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock window.location
delete window.location;
window.location = {
  ...window.location,
  href: '',
  pathname: '/',
  reload: vi.fn(),
} as Location;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// Setup and cleanup hooks
beforeAll(() => {
  // Reset all mocks and timers before tests
  vi.resetAllMocks();
  vi.useFakeTimers();
  
  // Mock console.error to catch React warnings
  const originalError = console.error;
  console.error = (...args) => {
    if (
      args[0]?.includes('Warning: An update to') ||
      args[0]?.includes('Warning: Cannot update a component')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterEach(async () => {
  // Run all pending timers and async operations
  await act(async () => {
    vi.runAllTimers();
  });
  
  // Cleanup React components
  cleanup();
  
  // Clear all mocks and reset timers
  vi.clearAllMocks();
  vi.useRealTimers();
  
  // Clear localStorage
  localStorage.clear();
});

afterAll(() => {
  // Final cleanup
  vi.resetAllMocks();
  vi.useRealTimers();
  cleanup();
});
