const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  testEnvironment: './src/app/tests/setup/test-environment.ts',
  setupFilesAfterEnv: ['<rootDir>/src/app/tests/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/src/app/tests/__mocks__/fileMock.js'
  },
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
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
    '!src/app/api/route.ts'
  ],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        transform: {
          react: {
            runtime: 'automatic'
          }
        }
      }
    }]
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/coverage/'
  ],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  testMatch: [
    '<rootDir>/src/app/**/*.test.{ts,tsx}'
  ]
}

module.exports = createJestConfig(customJestConfig)
