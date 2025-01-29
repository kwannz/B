import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectWallet, useAddress, useWallet, useConnectionStatus } from "@thirdweb-dev/react";
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAuthContext } from '../hooks/useAuth';

const MIN_SOL_BALANCE = 0.5;

export default function Login() {
  const address = useAddress();
  const wallet = useWallet();
  const connectionStatus = useConnectionStatus();
  const { connectWithWallet } = useAuthContext();
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  
  useEffect(() => {
    const handleWalletConnection = async () => {
      if (address && wallet) {
        try {
          await connectWithWallet();
          navigate('/agent-selection');
        } catch (error) {
          console.error('Wallet connection failed:', error);
        }
      }
    };

    handleWalletConnection();
  }, [address, wallet, connectWithWallet, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Connect Wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Connect your Solana wallet to access the trading platform.
              Minimum balance requirement: {MIN_SOL_BALANCE} SOL
            </AlertDescription>
          </Alert>
          
          <div className="flex justify-center">
            <ConnectWallet theme="dark" />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
