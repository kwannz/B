/// <reference types="vite/client" />

declare module '@thirdweb-dev/react' {
  import * as React from 'react';
  
  interface ConnectWalletProps {
    theme?: 'dark' | 'light';
    btnTitle?: string;
    modalTitle?: string;
  }
  
  const ConnectWallet: React.FC<ConnectWalletProps>;
  const useAddress: () => string | undefined;
  const useDisconnect: () => (() => Promise<void>) | undefined;
  const useConnect: () => (() => Promise<void>) | undefined;
  const useConnectionStatus: () => 'unknown' | 'connecting' | 'connected' | 'disconnected';
  const ThirdwebProvider: React.FC<{
    activeChain: {
      chainId: number;
      rpc: string[];
      nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
      };
      shortName: string;
      slug: string;
      testnet: boolean;
      chain: string;
      name: string;
    };
    clientId: string;
    supportedWallets: any[];
    autoConnect?: boolean;
    dAppMeta?: {
      name: string;
      description: string;
      logoUrl: string;
      url: string;
      isDarkMode: boolean;
    };
    children: React.ReactNode;
  }>;
  const phantomWallet: () => any;

  export {
    ConnectWallet,
    useAddress,
    useDisconnect,
    useConnect,
    useConnectionStatus,
    ThirdwebProvider,
    phantomWallet,
    type ConnectWalletProps
  };
}

declare global {
  interface Window {
    env: {
      NODE_ENV: 'development' | 'production';
    };
  }
}

interface ImportMetaEnv {
  readonly VITE_THIRDWEB_CLIENT_ID: string;
  readonly VITE_THIRDWEB_SECRET_KEY?: string;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
