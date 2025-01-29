import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useAddress, useDisconnect, useConnectionStatus, useConnect } from "@thirdweb-dev/react";
import { useNavigate } from 'react-router-dom';

type ConnectionStatus = "unknown" | "connecting" | "connected" | "disconnected";

const mockWallet = {
  address: "mock-wallet-address",
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
} as const;

interface AuthContextType {
  address: string | undefined;
  isAuthenticated: boolean;
  connectionStatus: ConnectionStatus;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isGoogleAuthenticated: boolean;
  googleLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [mockAddress, setMockAddress] = useState<string | undefined>(() => {
    if (window.env?.NODE_ENV === 'development') {
      const storedAddress = localStorage.getItem('mockWalletAddress');
      return storedAddress || undefined;
    }
    return undefined;
  });

  const realAddress = useAddress();
  const address = window.env?.NODE_ENV === 'development' ? mockAddress : realAddress;
  const disconnectHook = useDisconnect();
  const connectHook = useConnect();
  const realConnectionStatus = useConnectionStatus();
  const disconnect = disconnectHook || (() => Promise.resolve());
  const connect = connectHook || (() => Promise.resolve());
  const connectionStatus = (window.env?.NODE_ENV === 'development' && mockAddress ? "connected" : realConnectionStatus === "unknown" ? "disconnected" : realConnectionStatus) as ConnectionStatus;
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    if (window.env?.NODE_ENV === 'development' && mockAddress) {
      localStorage.setItem('mockWalletAddress', mockAddress);
    }
  }, [mockAddress]);

  const handleConnect = async () => {
    try {
      if (window.env?.NODE_ENV === 'development') {
        setMockAddress(mockWallet.address);
        return Promise.resolve();
      }
      return await connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  };

  useEffect(() => {
    const checkGoogleAuth = async () => {
      try {
        const response = await fetch('/api/auth/check-session');
        const data = await response.json();
        setIsGoogleAuthenticated(data.isAuthenticated);
      } catch (error) {
        console.error('Failed to check Google auth status:', error);
        setIsGoogleAuthenticated(false);
      }
    };
    checkGoogleAuth();
  }, []);

  const googleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsGoogleAuthenticated(false);
    } catch (error) {
      console.error('Failed to logout from Google:', error);
    }
  };

  const isAuthenticated = (!!address && connectionStatus === "connected") || isGoogleAuthenticated;

  const value: AuthContextType = {
    address,
    isAuthenticated,
    connectionStatus,
    connect: handleConnect,
    disconnect: async () => {
      if (window.env?.NODE_ENV === 'development') {
        setMockAddress(undefined);
        localStorage.removeItem('mockWalletAddress');
        return Promise.resolve();
      }
      const disconnectFn = disconnect();
      if (typeof disconnectFn === 'function') {
        return await disconnectFn();
      }
      return Promise.resolve();
    },
    isGoogleAuthenticated,
    googleLogout
  };
>>>>>>> origin/main

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// End of file
