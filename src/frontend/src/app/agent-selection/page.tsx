'use client';

import { Box, Typography, Grid, Card, CardContent, Button, Alert, Stepper, Step, StepLabel } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from '@/app/components/WalletConnect';

const steps = ['Agent Selection', 'Strategy Creation', 'Bot Integration', 'Wallet Setup', 'Trading Dashboard'];

export default function AgentSelection() {
  const router = useRouter();
  const { connected } = useWallet();

  const handleSelect = (type: 'trading' | 'defi') => {
    if (!connected) return;
    router.push(`/strategy-creation?type=${type}`);
  };

  return (
    <Box className="container mx-auto px-4 py-8">
      <Card className="max-w-4xl mx-auto">
        <CardContent className="space-y-6">
          <Typography variant="h5" component="h1" className="text-center mb-4">
            Select Your Trading Agent
          </Typography>

          <Stepper activeStep={0} alternativeLabel className="mb-8">
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {!connected && (
            <Alert severity="warning" className="mb-4">
              Please connect your wallet to start creating a trading bot
            </Alert>
          )}

          {!connected && <WalletConnect />}

          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Card className={`transition-all hover:shadow-lg ${!connected && 'opacity-50'}`}>
                <CardContent className="space-y-4">
                  <Typography variant="h6">Trading Agent</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Automated trading based on market analysis and strategies
                  </Typography>
                  <Box className="flex justify-between items-center">
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleSelect('trading')}
                      disabled={!connected}
                      size="large"
                    >
                      Select
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open('/docs/trading-agent', '_blank');
                      }}
                    >
                      Learn More
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card className={`transition-all hover:shadow-lg ${!connected && 'opacity-50'}`}>
                <CardContent className="space-y-4">
                  <Typography variant="h6">DeFi Agent</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Automated DeFi operations and yield optimization
                  </Typography>
                  <Box className="flex justify-between items-center">
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleSelect('defi')}
                      disabled={!connected}
                      size="large"
                    >
                      Select
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open('/docs/defi-agent', '_blank');
                      }}
                    >
                      Learn More
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
