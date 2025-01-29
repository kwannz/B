import React from 'react';
import { Box, AppBar, Toolbar, Typography, Container } from '@mui/material';
import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

interface MainLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, className, style }) => {
  return (
    <Box className={className} style={style} sx={{ 
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
        {children || <Outlet />}
      </Box>
    </Box>
  );
};

export default MainLayout;
