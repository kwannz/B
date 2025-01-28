import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAuthContext } from '../hooks/useAuth';

require('@solana/wallet-adapter-react-ui/styles.css');

const MIN_SOL_BALANCE = 0.5;

export default function Login() {
  const { connected, publicKey, wallet } = useWallet();
  const { connectWithWallet } = useAuthContext();
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleWalletConnection = async () => {
      if (connected && publicKey) {
        try {
          await connectWithWallet();
          navigate('/agent-selection');
        } catch (error) {
          console.error('Wallet connection failed:', error);
        }
      }
    };

    handleWalletConnection();
  }, [connected, publicKey, connectWithWallet, navigate]);

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
            <WalletMultiButton />
          </div>

          {wallet && (
            <Alert variant="destructive">
              <AlertDescription>
                Please ensure your wallet has a minimum balance of {MIN_SOL_BALANCE} SOL
                to access trading features.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
