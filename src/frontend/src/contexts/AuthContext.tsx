import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAddress, useDisconnect, useConnectionStatus } from "@thirdweb-dev/react";

// Mock wallet for testing
const mockWallet = {
  address: "mock-wallet-address",
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
};

<<<<<<< HEAD
const AuthContext = createContext<any>(null);
||||||| 8d442a778
interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, username: string, password: string) => Promise<boolean>;
  logout: () => void;
}
=======
interface AuthContextType {
  address: string | undefined;
  isAuthenticated: boolean;
  connectionStatus: "unknown" | "connecting" | "connected" | "disconnected";
  disconnect: () => void;
  isGoogleAuthenticated: boolean;
  googleLogout: () => void;
}
>>>>>>> origin/main

<<<<<<< HEAD
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
||||||| 8d442a778
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
=======
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use mock wallet in development
  const [mockAddress, setMockAddress] = useState<string | undefined>(() => {
    if (process.env.NODE_ENV === 'development') {
      return localStorage.getItem('mockWalletAddress') || undefined;
    }
    return undefined;
  });
  const address = process.env.NODE_ENV === 'development' ? mockAddress : useAddress();
  const disconnect = useDisconnect();
  const connectionStatus = process.env.NODE_ENV === 'development' && mockAddress ? "connected" : useConnectionStatus();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && mockAddress) {
      localStorage.setItem('mockWalletAddress', mockAddress);
    }
  }, [mockAddress]);
  
  // Mock connect function for testing
  const mockConnect = () => {
    setMockAddress(mockWallet.address);
  };
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState<boolean>(false);

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

  const value = {
    address,
    isAuthenticated,
    connectionStatus,
    disconnect,
    isGoogleAuthenticated,
    googleLogout
  };
>>>>>>> origin/main

  return (
<<<<<<< HEAD
    <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated }}>
||||||| 8d442a778
    <AuthContext.Provider value={auth}>
=======
    <AuthContext.Provider value={value}>
>>>>>>> origin/main
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
