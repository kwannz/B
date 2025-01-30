const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/src/app/tests/setup/jest.setup.ts',
    '<rootDir>/src/app/tests/setup/test-matchers.ts',
    '<rootDir>/src/app/tests/setup/test-assertions.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/src/app/tests/__mocks__/fileMock.js'
  },
  testMatch: [
    '<rootDir>/src/app/tests/**/*.test.{ts,tsx}',
    '<rootDir>/src/app/tests/integration/**/*.test.{ts,tsx}'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$'
  ],
  testTimeout: 30000,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/app/agent-selection/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/app/strategy-creation/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/app/bot-integration/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/app/key-management/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/app/trading-dashboard/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/app/wallet-comparison/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  collectCoverageFrom: [
    'src/app/**/*.{ts,tsx}',
    '!src/app/tests/**',
    '!src/app/**/*.d.ts',
    '!src/app/types/**',
    '!src/app/api/route.ts',
    '!src/app/layout.tsx',
    '!src/app/page.tsx'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  verbose: true,
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    },
    React: 'react'
  }
}

module.exports = createJestConfig(customJestConfig)
