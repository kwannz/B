'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Box, AppBar, Toolbar, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { useAddress, ConnectWallet, useDisconnect } from "@thirdweb-dev/react";
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';

interface MainLayoutProps {
  children: ReactNode;
  className?: string;
  testId?: string;
  'data-testid'?: string;
}

const AgentStatus = dynamic<Record<string, never>>(
  () => import('@/app/components/AgentStatus'),
  {
    ssr: false,
    loading: () => <CircularProgress data-testid="loading-spinner" />
  }
);

export default function MainLayout({ children, className }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const address = useAddress();
  const disconnect = useDisconnect();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isAuthPath = pathname?.includes('/(auth)');
  const showAgentStatus = pathname === '/' || pathname?.includes('/(auth)/dashboard') || pathname?.includes('/(auth)/developer');
  const isLoggedIn = Boolean(address);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!isLoggedIn && !pathname?.includes('/login')) {
          await router.push('/login');
          router.refresh();
        }
      } catch (err) {
        setError('Authentication failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (pathname) {
      checkAuth();
    }
  }, [isLoggedIn, pathname, router]);

  const handleDisconnect = async () => {
    await disconnect();
    router.push('/');
    router.refresh();
  };

  const handleDashboard = () => {
    router.push('/(auth)/dashboard');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress data-testid="loading-spinner" />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }} data-testid="error-message">
        {error}
      </Alert>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh',
        bgcolor: '#121212',
        color: '#ffffff'
      }} data-testid="main-layout">
        <AppBar position="static" sx={{ bgcolor: '#1e1e1e', boxShadow: 1 }}>
          <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="div" sx={{ color: '#ffffff' }}>
              Trading Bot Dashboard
            </Typography>
            {!isAuthPath ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ConnectWallet
                  theme="dark"
                  btnTitle="Configure New Agent"
                  modalSize="wide"
                  data-testid="connect-wallet"
                />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button 
                  color="inherit" 
                  onClick={handleDashboard} 
                  data-testid="dashboard-button"
                >
                  Dashboard
                </Button>
                <Button 
                  color="inherit" 
                  onClick={handleDisconnect} 
                  data-testid="disconnect-button"
                >
                  Disconnect
                </Button>
              </Box>
            )}
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ width: '100%', flex: 1, p: 3 }}>
          {showAgentStatus && (
            <ErrorBoundary>
              <AgentStatus />
            </ErrorBoundary>
          )}
          {children}
        </Box>
      </Box>
    </ErrorBoundary>
  );
}
