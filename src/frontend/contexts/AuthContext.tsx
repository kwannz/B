import React, { createContext, useContext, ReactNode } from 'react';
import { useAddress, useDisconnect, useConnectionStatus } from "@thirdweb-dev/react";

interface AuthContextType {
  address: string | undefined;
  isAuthenticated: boolean;
  connectionStatus: "unknown" | "connecting" | "connected" | "disconnected";
  disconnect: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const address = useAddress();
  const disconnect = useDisconnect();
  const connectionStatus = useConnectionStatus();
  const isAuthenticated = !!address && connectionStatus === "connected";

  const value = {
    address,
    isAuthenticated,
    connectionStatus,
    disconnect
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
