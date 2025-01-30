declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VITE_API_URL: string;
      VITE_SOLANA_NETWORK: string;
      VITE_THIRDWEB_CLIENT_ID: string;
      VITE_SOLANA_RPC_URL: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

export {};
