import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Container } from '@mui/material';

const MainLayout: React.FC = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {!isLoginPage && (
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6">Trading Bot Dashboard</Typography>
          </Toolbar>
        </AppBar>
      )}
      <Container 
        component="main" 
        maxWidth={isLoginPage ? "sm" : "lg"}
        sx={{ 
          mt: isLoginPage ? 0 : 4, 
          mb: isLoginPage ? 0 : 4, 
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isLoginPage ? 'center' : 'flex-start',
          height: '100%'
        }}
      >
        <Outlet />
      </Container>
    </Box>
  );
};

export default MainLayout;
