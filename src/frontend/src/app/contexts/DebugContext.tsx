'use client';

import React, { createContext, useContext, useState } from 'react';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'System' | 'Model' | 'Trading' | 'ErrorBoundary';

export interface DebugContextType {
  isDebugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  log: (level: LogLevel, category: LogCategory, message: string, data?: any) => void;
}

export const DebugContext = createContext<DebugContextType>({
  isDebugMode: false,
  setDebugMode: () => {},
  log: () => {}
});

export const useDebug = () => useContext(DebugContext);

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDebugMode, setDebugMode] = useState(false);

  const log = (level: LogLevel, category: LogCategory, message: string, data?: any) => {
    if (!isDebugMode) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      category,
      message,
      data
    };

    switch (level) {
      case 'error':
        console.error(`[${category}]`, logEntry);
        break;
      case 'warn':
        console.warn(`[${category}]`, logEntry);
        break;
      case 'info':
        console.info(`[${category}]`, logEntry);
        break;
      case 'debug':
        console.debug(`[${category}]`, logEntry);
        break;
    }
  };

  return (
    <DebugContext.Provider value={{ isDebugMode, setDebugMode, log }}>
      {children}
    </DebugContext.Provider>
  );
};
