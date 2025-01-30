'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, CircularProgress, Alert, Button, Stepper, Step, StepLabel } from '@mui/material';
import PerformanceMetrics from '@/app/components/PerformanceMetrics';
import TransferDialog from '@/app/components/TransferDialog';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from '@/app/components/WalletConnect';
import { listWallets } from '@/app/api/client';

const steps = ['Agent Selection', 'Strategy Creation', 'Bot Integration', 'Wallet Setup', 'Trading Dashboard'];

interface Wallet {
  address: string;
  balance: number;
  bot_id: string;
  type: 'A' | 'B';
  performance?: {
    total_trades: number;
    success_rate: number;
    avg_return: number;
  };
}

export default function WalletComparison() {
  const router = useRouter();
  const { connected } = useWallet();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallets, setSelectedWallets] = useState<{ A?: Wallet; B?: Wallet }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferDialog, setTransferDialog] = useState<{
    open: boolean;
    fromAddress?: string;
    toAddress?: string;
    fromLabel?: string;
    toLabel?: string;
    maxAmount?: number;
  }>({ open: false });

  useEffect(() => {
    if (!connected) {
      setLoading(false);
      return;
    }

    const fetchWallets = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listWallets();
        setWallets(data.wallets);
      } catch (err) {
        console.error('Failed to fetch wallets:', err);
        setError('Failed to load wallets. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchWallets();
  }, [connected]);

  if (!connected) {
    return (
      <Box className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="space-y-6">
            <Typography variant="h5" component="h1" className="text-center mb-4">
              Wallet Comparison
            </Typography>

            <Stepper activeStep={-1} alternativeLabel className="mb-8">
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Alert severity="warning">
              Please connect your wallet to view wallet comparisons
            </Alert>
            <WalletConnect />
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box className="container mx-auto px-4 py-8">
      <Card className="max-w-4xl mx-auto">
        <CardContent className="space-y-6">
          <Typography variant="h5" component="h1" className="text-center mb-4">
            Wallet Comparison
          </Typography>

          <Stepper activeStep={-1} alternativeLabel className="mb-8">
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box className="flex justify-end mb-4">
            <Button
              variant="contained"
              color="primary"
              onClick={() => router.push('/agent-selection')}
              size="large"
            >
              Create New Bot
            </Button>
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box className="flex justify-center py-8">
              <CircularProgress />
            </Box>
          ) : (
            <Box className="space-y-6">
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Card className="h-full">
                    <CardContent className="space-y-4">
                      <Typography variant="h6">Wallet A</Typography>
                      {selectedWallets.A ? (
                        <Box className="space-y-4">
                          <Box className="space-y-2">
                            <Typography variant="body2" color="text.secondary">Address</Typography>
                            <Typography className="break-all font-mono p-2 bg-gray-50 rounded">
                              {selectedWallets.A.address}
                            </Typography>
                          </Box>
                          <Box className="space-y-2">
                            <Typography variant="body2" color="text.secondary">Balance</Typography>
                            <Typography variant="h5" className="font-bold">
                              {selectedWallets.A.balance.toFixed(4)} SOL
                            </Typography>
                          </Box>
                          {selectedWallets.A.performance && (
                            <Box className="space-y-2">
                              <Typography variant="body2" color="text.secondary">Performance</Typography>
                              <Box className="grid grid-cols-3 gap-4">
                                <Box>
                                  <Typography variant="h6">{selectedWallets.A.performance.total_trades}</Typography>
                                  <Typography variant="caption">Total Trades</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="h6">{selectedWallets.A.performance.success_rate}%</Typography>
                                  <Typography variant="caption">Success Rate</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="h6">{selectedWallets.A.performance.avg_return}%</Typography>
                                  <Typography variant="caption">Avg Return</Typography>
                                </Box>
                              </Box>
                            </Box>
                          )}
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={() => setSelectedWallets(prev => ({ ...prev, A: undefined }))}
                          >
                            Clear Selection
                          </Button>
                        </Box>
                      ) : (
                        <Box className="space-y-2">
                          <Typography color="text.secondary">Select a wallet to compare</Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card className="h-full">
                    <CardContent className="space-y-4">
                      <Typography variant="h6">Wallet B</Typography>
                      {selectedWallets.B ? (
                        <Box className="space-y-4">
                          <Box className="space-y-2">
                            <Typography variant="body2" color="text.secondary">Address</Typography>
                            <Typography className="break-all font-mono p-2 bg-gray-50 rounded">
                              {selectedWallets.B.address}
                            </Typography>
                          </Box>
                          <Box className="space-y-2">
                            <Typography variant="body2" color="text.secondary">Balance</Typography>
                            <Typography variant="h5" className="font-bold">
                              {selectedWallets.B.balance.toFixed(4)} SOL
                            </Typography>
                          </Box>
                          {selectedWallets.B.performance && (
                            <Box className="space-y-2">
                              <Typography variant="body2" color="text.secondary">Performance</Typography>
                              <Box className="grid grid-cols-3 gap-4">
                                <Box>
                                  <Typography variant="h6">{selectedWallets.B.performance.total_trades}</Typography>
                                  <Typography variant="caption">Total Trades</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="h6">{selectedWallets.B.performance.success_rate}%</Typography>
                                  <Typography variant="caption">Success Rate</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="h6">{selectedWallets.B.performance.avg_return}%</Typography>
                                  <Typography variant="caption">Avg Return</Typography>
                                </Box>
                              </Box>
                            </Box>
                          )}
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={() => setSelectedWallets(prev => ({ ...prev, B: undefined }))}
                          >
                            Clear Selection
                          </Button>
                        </Box>
                      ) : (
                        <Box className="space-y-2">
                          <Typography color="text.secondary">Select a wallet to compare</Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {selectedWallets.A && selectedWallets.B && (
                <>
                  <Card>
                    <CardContent className="space-y-6">
                      <Typography variant="h6">Performance Comparison</Typography>
                      <Box className="space-y-4">
                        <PerformanceMetrics
                          labelA="Wallet A"
                          labelB="Wallet B"
                          valueA={selectedWallets.A.performance?.total_trades || 0}
                          valueB={selectedWallets.B.performance?.total_trades || 0}
                          unit=""
                          label="Total Trades"
                        />
                        <PerformanceMetrics
                          labelA="Wallet A"
                          labelB="Wallet B"
                          valueA={selectedWallets.A.performance?.success_rate || 0}
                          valueB={selectedWallets.B.performance?.success_rate || 0}
                          unit="%"
                          label="Success Rate"
                        />
                        <PerformanceMetrics
                          labelA="Wallet A"
                          labelB="Wallet B"
                          valueA={selectedWallets.A.performance?.avg_return || 0}
                          valueB={selectedWallets.B.performance?.avg_return || 0}
                          unit="%"
                          label="Average Return"
                        />
                      </Box>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="space-y-4">
                      <Typography variant="h6">Cross-Wallet Actions</Typography>
                      <Box className="flex gap-4">
                        <Button
                          variant="contained"
                          onClick={() => setTransferDialog({
                            open: true,
                            fromAddress: selectedWallets.A.address,
                            toAddress: selectedWallets.B.address,
                            fromLabel: 'Wallet A',
                            toLabel: 'Wallet B',
                            maxAmount: selectedWallets.A.balance
                          })}
                        >
                          Transfer SOL A → B
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => setTransferDialog({
                            open: true,
                            fromAddress: selectedWallets.B.address,
                            toAddress: selectedWallets.A.address,
                            fromLabel: 'Wallet B',
                            toLabel: 'Wallet A',
                            maxAmount: selectedWallets.B.balance
                          })}
                        >
                          Transfer SOL B → A
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </>
              )}
              
              <TransferDialog
                open={transferDialog.open}
                onClose={() => {
                  setTransferDialog({ open: false });
                  fetchWallets();
                }}
                fromAddress={transferDialog.fromAddress || ''}
                toAddress={transferDialog.toAddress || ''}
                fromLabel={transferDialog.fromLabel || ''}
                toLabel={transferDialog.toLabel || ''}
                maxAmount={transferDialog.maxAmount || 0}
              />

              <Typography variant="h6" className="mt-8 mb-4">Available Wallets</Typography>
              <Grid container spacing={4}>
                {wallets.map((wallet) => (
                  <Grid item xs={12} md={6} key={wallet.address}>
                    <Card className="h-full hover:shadow-lg transition-shadow">
                      <CardContent className="space-y-4">
                        <Box className="flex justify-between items-start">
                          <Typography variant="h6" gutterBottom>
                            Bot ID: {wallet.bot_id}
                          </Typography>
                          <Box className="space-x-2">
                            {!selectedWallets.A && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setSelectedWallets(prev => ({ ...prev, A: wallet }))}
                              >
                                Select as A
                              </Button>
                            )}
                            {!selectedWallets.B && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setSelectedWallets(prev => ({ ...prev, B: wallet }))}
                              >
                                Select as B
                              </Button>
                            )}
                          </Box>
                        </Box>
                        <Box className="space-y-2">
                          <Typography variant="body2" color="text.secondary">
                            Address
                          </Typography>
                          <Typography className="break-all font-mono p-2 bg-gray-50 rounded">
                            {wallet.address}
                          </Typography>
                        </Box>
                        <Box className="space-y-2">
                          <Typography variant="body2" color="text.secondary">
                            Balance
                          </Typography>
                          <Typography variant="h5" className="font-bold">
                            {wallet.balance.toFixed(4)} SOL
                          </Typography>
                        </Box>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => router.push(`/trading-dashboard?botId=${wallet.bot_id}`)}
                        >
                          View Dashboard
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
                {wallets.length === 0 && (
                  <Grid item xs={12}>
                    <Alert severity="info" action={
                      <Button color="inherit" size="small" onClick={() => router.push('/agent-selection')}>
                        Create Bot
                      </Button>
                    }>
                      No wallets found. Create a trading bot to get started.
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
