'use client';

import { Box, Typography, CircularProgress, Button, Alert } from '@mui/material';

interface BotStatusProps {
  isProcessing: boolean;
  error: string | null;
  botId: string | null;
  onBack: () => void;
  onContinue: () => void;
}

export default function BotStatus({ isProcessing, error, botId, onBack, onContinue }: BotStatusProps) {
  if (isProcessing) {
    return (
      <Box className="flex flex-col items-center gap-4 py-8">
        <CircularProgress />
        <Typography>Initializing your trading bot...</Typography>
      </Box>
    );
  }

  if (botId) {
    return (
      <Box className="space-y-4">
        <Alert severity="success">
          Trading bot successfully created!
        </Alert>
        <Box className="flex gap-4 mt-6">
          <Button
            variant="outlined"
            onClick={onBack}
            size="large"
            className="flex-1"
          >
            Back
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={onContinue}
            size="large"
            className="flex-1"
          >
            Continue to Wallet Setup
          </Button>
        </Box>
      </Box>
    );
  }

  return null;
}
