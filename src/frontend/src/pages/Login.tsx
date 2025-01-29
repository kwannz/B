import { Box, Typography, Button, Divider, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ConnectWallet } from "@thirdweb-dev/react";
import { Google as GoogleIcon } from '@mui/icons-material';
import { useAuthContext } from '../contexts/AuthContext';
import { FC, useEffect } from 'react';

declare global {
  interface ImportMetaEnv {
    MODE: 'development' | 'production';
  }
}

const Login: FC = () => {
  const navigate = useNavigate();
  const auth = useAuthContext();
  if (!auth) return null;
  const { isAuthenticated, isGoogleAuthenticated, connect } = auth;
  const isDevelopment = window.env?.NODE_ENV === 'development';

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const handleMockWalletConnect = async () => {
    try {
      await connect();
      navigate('/');
    } catch (error) {
      console.error('Failed to connect mock wallet:', error);
    }
  };

  if (!auth) {
    return null;
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 64px)',
      p: 2,
      bgcolor: '#121212',
      color: '#ffffff',
      mt: '64px'
    }}>
      <Paper elevation={3} sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: 3,
        width: '100%',
        maxWidth: '400px',
        p: 4,
        bgcolor: '#1e1e1e',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        position: 'relative',
        zIndex: 1
      }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', textAlign: 'center', color: 'text.primary', mb: 2 }}>
          Welcome to Trading Bot
        </Typography>
        <Typography variant="subtitle1" sx={{ color: 'text.secondary', textAlign: 'center', mb: 4, px: 2 }}>
          Connect your wallet or sign in with Google to access our intelligent trading agents
        </Typography>
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ width: '100%', mb: 2 }}>
            {isDevelopment ? (
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleMockWalletConnect}
                sx={{
                  py: 2,
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark'
                  }
                }}
              >
                Connect Mock Wallet
              </Button>
            ) : (
              <ConnectWallet 
                theme="dark"
                btnTitle="Connect Wallet"
                modalTitle="Select Your Wallet"
              />
            )}
          </Box>
          
          <Divider sx={{ 
            '&::before, &::after': { 
              borderColor: 'divider' 
            },
            color: 'text.secondary'
          }}>
            OR
          </Divider>
          
          <Button
            variant="outlined"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            disabled={isGoogleAuthenticated}
            sx={{ 
              py: 2,
              borderColor: 'divider',
              color: 'text.primary',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'action.hover'
              }
            }}
          >
            {isGoogleAuthenticated ? 'Signed in with Google' : 'Sign in with Google'}
          </Button>
        </Box>
        <Button 
          variant="text" 
          onClick={() => navigate('/')}
          sx={{ 
            mt: 2,
            color: 'primary.main',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          Back to Home
        </Button>
      </Paper>
    </Box>
  );
};

export { Login as default };
