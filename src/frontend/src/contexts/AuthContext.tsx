import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useAddress, useDisconnect, useConnectionStatus } from "@thirdweb-dev/react";

interface AuthContextType {
  address: string | undefined;
  isAuthenticated: boolean;
  connectionStatus: "unknown" | "connecting" | "connected" | "disconnected";
  disconnect: () => void;
  isGoogleAuthenticated: boolean;
  googleLogout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const address = useAddress();
  const disconnect = useDisconnect();
  const connectionStatus = useConnectionStatus();
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
