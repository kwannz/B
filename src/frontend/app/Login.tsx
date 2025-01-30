import React from 'react';
import { useRouter } from 'next/router';
import { ConnectWallet, useAddress, useWallet, useConnectionStatus, useBalance } from "@thirdweb-dev/react";
import { Card, CardContent, Typography, Alert, AlertTitle, Box, CircularProgress } from '@mui/material';

const MIN_SOL_BALANCE = 0.5;

export default function Login() {
  const address = useAddress();
  const wallet = useWallet();
  const connectionStatus = useConnectionStatus();
  const { data: balance } = useBalance();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);
  
  React.useEffect(() => {
    const checkWalletAndBalance = async () => {
      if (address && wallet) {
        setIsChecking(true);
        try {
          const balanceInSOL = balance ? parseFloat(balance.displayValue) : 0;
          if (balanceInSOL < MIN_SOL_BALANCE) {
            setError(`Insufficient balance. Minimum ${MIN_SOL_BALANCE} SOL required.`);
            return;
          }
          router.push('/agent-selection');
        } catch (err) {
          setError('Failed to verify wallet balance. Please try again.');
        } finally {
          setIsChecking(false);
        }
      }
    };
    
    checkWalletAndBalance();
  }, [address, wallet, balance, router]);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh', 
        padding: '1rem',
        background: 'linear-gradient(45deg, rgba(25,118,210,0.1) 0%, rgba(220,0,78,0.1) 100%)',
      }}
    >
      <Card 
        sx={{ 
          width: '100%',
          bgcolor: 'background.paper',
          boxShadow: 3,
          borderRadius: 2,
          p: 2,
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(30, 30, 30, 0.9)',
        }}
      >
        <CardContent>
          <Typography 
            variant="h5" 
            component="h1" 
            gutterBottom 
            sx={{ 
              fontWeight: 'bold',
              textAlign: 'center',
              mb: 3
            }}
          >
            Connect Wallet
          </Typography>

          <Alert 
            severity="info" 
            sx={{ 
              mb: 2,
              backgroundColor: 'rgba(33, 150, 243, 0.1)',
              border: '1px solid rgba(33, 150, 243, 0.3)',
            }}
          >
            <AlertTitle>Welcome to Trading Bot</AlertTitle>
            Connect your Solana wallet to access the trading platform.
            Minimum balance requirement: {MIN_SOL_BALANCE} SOL
          </Alert>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <Box sx={{ position: 'relative' }}>
              <ConnectWallet
                theme="dark"
                btnTitle={isChecking ? "Verifying Balance..." : "Connect Wallet"}
                modalTitle="Connect Your Wallet"
                style={{ 
                  width: '100%',
                  opacity: isChecking ? 0.7 : 1,
                  pointerEvents: isChecking ? 'none' : 'auto'
                }}
              />
              {(connectionStatus === "connecting" || isChecking) && (
                <CircularProgress
                  size={24}
                  sx={{
                    position: 'absolute',
                    right: 16,
                    top: '50%',
                    marginTop: '-12px',
                  }}
                />
              )}
            </Box>
            
            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  width: '100%',
                  '& .MuiAlert-message': { width: '100%' },
                  backgroundColor: 'rgba(211, 47, 47, 0.1)',
                  border: '1px solid rgba(211, 47, 47, 0.3)',
                }}
              >
                <AlertTitle>Connection Error</AlertTitle>
                {error}
              </Alert>
            )}

            {connectionStatus === "connecting" && (
              <Alert 
                severity="info"
                sx={{ 
                  width: '100%',
                  '& .MuiAlert-message': { width: '100%' },
                  backgroundColor: 'rgba(33, 150, 243, 0.1)',
                  border: '1px solid rgba(33, 150, 243, 0.3)',
                }}
              >
                <AlertTitle>Connecting</AlertTitle>
                Please approve the connection request in your wallet
              </Alert>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
