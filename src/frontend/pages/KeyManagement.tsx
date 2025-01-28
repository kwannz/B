import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import apiClient from '../api/client';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const KeyManagement: React.FC = () => {
  const navigate = useNavigate();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // These are the provided wallet credentials
  const walletAddress = 'Bmy8pkxSMLHTdaCop7urr7b4FPqs3QojVsGuC9Ly4vsU';
  const privateKey = '29f8rVGdqnNAeJPffprmrPzbXnbuhTwRML4EeZYRsG3oyHcXnFpVvSxrC87s3YJy4UqRoYQSpCTNMpBH8q5VkzMx';

  useEffect(() => {
    const validateWallet = async () => {
      try {
        const response = await apiClient.getWalletBalance(walletAddress);
        if (!response.success) {
          throw new Error(response.error || 'Failed to validate wallet');
        }
        localStorage.setItem('walletAddress', walletAddress);
      } catch (err) {
        setError('Failed to validate wallet. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    validateWallet();
  }, []);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
  };

  const handleCopyPrivateKey = () => {
    navigator.clipboard.writeText(privateKey);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await apiClient.confirmWallet(walletAddress);
      
      if (response.success) {
        // Store wallet info in localStorage for other components
        localStorage.setItem('walletAddress', walletAddress);
        navigate('/strategy-creation');
      } else {
        setError(typeof response.error === 'string' ? response.error : 'Failed to confirm key management');
      }
    } catch (err) {
      setError('Failed to confirm key management. Please try again.');
    } finally {
      setIsSubmitting(false);
      setConfirmDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Key Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Alert severity="warning" sx={{ mb: 3 }}>
        Important: Store your private key securely. Never share it with anyone.
      </Alert>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Wallet Address
          </Typography>
          <TextField
            fullWidth
            value={walletAddress}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopyAddress}>
                    <CopyIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Private Key
          </Typography>
          <TextField
            fullWidth
            type={showPrivateKey ? 'text' : 'password'}
            value={privateKey}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPrivateKey(!showPrivateKey)}>
                    {showPrivateKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                  <IconButton onClick={handleCopyPrivateKey}>
                    <CopyIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={() => setConfirmDialogOpen(true)}
        >
          I Have Saved My Keys Securely
        </Button>
      </Paper>

      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Confirm Key Management</DialogTitle>
        <DialogContent>
          <Typography>
            Please confirm that you have saved your private key in a secure location.
            You will not be able to recover it if lost.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setConfirmDialogOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={24} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KeyManagement;
