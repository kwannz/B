import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ConnectWallet } from "@thirdweb-dev/react";

const Login = () => {
  const navigate = useNavigate();

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
        Connect your wallet to access our intelligent trading agents
      </Typography>
      <ConnectWallet 
        theme="dark"
        btnTitle="Connect Wallet"
        modalTitle="Select Your Wallet"
      />
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
