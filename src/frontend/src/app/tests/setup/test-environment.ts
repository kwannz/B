const JSDOMEnvironment = require('jest-environment-jsdom');
const { TextEncoder, TextDecoder } = require('util');
const { expect, jest } = require('@jest/globals');

class CustomTestEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;
    this.global.fetch = global.fetch;
    this.global.expect = expect;
    this.global.jest = jest;

    Object.defineProperty(this.global, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })
    });

    Object.defineProperty(this.global, 'ResizeObserver', {
      writable: true,
      configurable: true,
      value: class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    });

    Object.defineProperty(this.global, 'localStorage', {
      writable: true,
      configurable: true,
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        key: jest.fn(),
        length: 0
      }
    });

    Object.defineProperty(this.global, 'sessionStorage', {
      writable: true,
      configurable: true,
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        key: jest.fn(),
        length: 0
      }
    });
  }
}

module.exports = CustomTestEnvironment;
