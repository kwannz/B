import { Box, Typography, Button, Divider, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ConnectWallet, useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { Google as GoogleIcon } from '@mui/icons-material';
import { useAuthContext } from '../contexts/AuthContext';
import { useEffect } from 'react';

const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isGoogleAuthenticated } = useAuthContext();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: 4,
      p: 4,
      textAlign: 'center'
    }}>
      <Typography variant="h4" gutterBottom>
        Welcome to Trading Bot
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, maxWidth: '600px' }}>
        Connect your wallet or sign in with Google to access our intelligent trading agents
      </Typography>
      {process.env.NODE_ENV === 'development' ? (
        <button
          onClick={() => {
            localStorage.setItem('mockWalletAddress', 'mock-wallet-address');
            window.location.reload();
          }}
          style={{
            padding: '12px 24px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Connect Mock Wallet
        </button>
      ) : (
        <ConnectWallet 
          theme="dark"
          btnTitle="Connect Wallet"
          modalTitle="Select Your Wallet"
        />
      )}
      <Divider sx={{ width: '100%', my: 2 }}>OR</Divider>
      <Button
        variant="outlined"
        startIcon={<GoogleIcon />}
        onClick={handleGoogleLogin}
        disabled={isGoogleAuthenticated}
        sx={{ 
          width: '240px',
          backgroundColor: 'white',
          color: 'text.primary',
          '&:hover': {
            backgroundColor: 'grey.100'
          }
        }}
      >
        {isGoogleAuthenticated ? 'Signed in with Google' : 'Sign in with Google'}
      </Button>
      <Button 
        variant="text" 
        onClick={() => navigate('/')}
        sx={{ mt: 2 }}
      >
        Back to Home
      </Button>
    </Box>
  );
};

export default Login;
