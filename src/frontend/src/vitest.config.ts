/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from 'path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    deps: {
      fallbackCJS: true,
      optimizer: {
        web: {
          include: ['@solana/web3.js', '@solana/wallet-adapter-react']
        }
      }
    },
    testTimeout: 60000,
    hookTimeout: 60000,
    reporters: ['default'],
    onConsoleLog(log, type) {
      if (type === 'error') console.error(log);
      return false;
    },
    threads: false,
    isolate: false,
    maxConcurrency: 1,
    sequence: {
      shuffle: false
    }
  },
});
