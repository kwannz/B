const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/app/\\(auth\\)/([^/]+)/page$': '<rootDir>/app/(auth)/$1/page.tsx',
    '^@/app/([^/]+)/page$': '<rootDir>/app/$1/page.tsx',
    '^@/app/components/(.*)$': '<rootDir>/app/components/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/components/(.*)$': '<rootDir>/app/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/api/(.*)$': '<rootDir>/app/api/$1',
    '^@/tests/(.*)$': '<rootDir>/tests/$1',
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@mui/material/(.*)$': '<rootDir>/node_modules/@mui/material/$1',
    '^@mui/(.*)$': '<rootDir>/node_modules/@mui/$1'
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    '!app/**/_*.{js,jsx,ts,tsx}',
    '!app/**/*.d.ts',
    '!app/api/**/*.{js,jsx,ts,tsx}',
    '!app/layout.tsx',
    '!app/template.tsx',
    '!app/providers.tsx',
    '!app/(auth)/layout.tsx',
    '!app/services/**/*.{js,jsx,ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@thirdweb-dev|uint8arrays|multiformats|@solana|@project-serum|@coral-xyz|@metaplex-foundation|bs58|eventemitter3|bn.js|buffer|borsh|superstruct|@mui)/)'
  ],
  testEnvironmentOptions: {
    customExportConditions: [''],
  }
}

module.exports = createJestConfig(customJestConfig)
