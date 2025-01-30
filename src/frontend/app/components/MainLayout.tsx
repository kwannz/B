'use client';

import { Box, AppBar, Toolbar, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useAddress } from "@thirdweb-dev/react";
import { useRouter } from 'next/navigation';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const address = useAddress();

  if (!address) {
    router.push('/login');
    return null;
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh',
      bgcolor: '#121212',
      color: '#ffffff'
    }}>
      <AppBar position="fixed" sx={{ bgcolor: '#1e1e1e', boxShadow: 1 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: '#ffffff' }}>
            Trading Bot Dashboard
          </Typography>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ mt: 8, width: '100%', flex: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
