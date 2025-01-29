import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useConnectionStatus, useConnect } from "@thirdweb-dev/react";
import { phantomWallet } from "@thirdweb-dev/react";

const Login = () => {
  const connect = useConnect();
  const connectionStatus = useConnectionStatus();
  const isConnecting = connectionStatus === "connecting";

  const handleConnect = async () => {
    try {
      await connect(phantomWallet());
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  return (
    <Box sx={{ 
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      p: 4,
      maxWidth: 400,
      mx: 'auto'
    }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome to Trading Bot
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Connect your wallet to start trading
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={handleConnect}
        disabled={isConnecting}
        sx={{ py: 1.5 }}
      >
        {isConnecting ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Connect Wallet'
        )}
      </Button>
    </Box>
  );
};

export default Login;
