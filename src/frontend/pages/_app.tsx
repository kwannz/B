import React from 'react';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, AppBar, Toolbar, Typography } from '@mui/material';
import { theme } from '../components/mui-theme';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
          <Component {...pageProps} />
        </Box>
      </Box>
    </ThemeProvider>
  );
}
