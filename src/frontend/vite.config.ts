import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'tsconfig': path.resolve(__dirname, 'tsconfig.json')
    }
  },
  define: {
    'window.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development')
    },
    'process.env.VITE_THIRDWEB_CLIENT_ID': JSON.stringify('a3e2d3f54b3416c87c25630e9431adce')
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true
  }
});
