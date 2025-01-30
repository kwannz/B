'use client';

import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert } from '@mui/material';
import { transferSOL } from '@/app/api/client';

interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
  fromAddress: string;
  toAddress: string;
  fromLabel: string;
  toLabel: string;
  maxAmount: number;
}

export default function TransferDialog({
  open,
  onClose,
  fromAddress,
  toAddress,
  fromLabel,
  toLabel,
  maxAmount,
}: TransferDialogProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (transferAmount > maxAmount) {
      setError('Insufficient balance');
      return;
    }
    if (transferAmount < 0.01) {
      setError('Minimum transfer amount is 0.01 SOL');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await transferSOL(fromAddress, toAddress, transferAmount);
      onClose();
    } catch (err) {
      console.error('Transfer failed:', err);
      setError('Failed to transfer SOL. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Transfer SOL</DialogTitle>
      <DialogContent>
        <div className="space-y-4 py-4">
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <div className="space-y-2">
            <div>From: {fromLabel}</div>
            <div className="font-mono text-sm break-all bg-gray-50 p-2 rounded">
              {fromAddress}
            </div>
          </div>
          <div className="space-y-2">
            <div>To: {toLabel}</div>
            <div className="font-mono text-sm break-all bg-gray-50 p-2 rounded">
              {toAddress}
            </div>
          </div>
          <TextField
            fullWidth
            label="Amount (SOL)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isSubmitting}
            inputProps={{
              min: 0.01,
              max: maxAmount,
              step: 0.01,
            }}
          />
          <div className="text-sm text-gray-500">
            Available balance: {maxAmount.toFixed(4)} SOL
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!amount || isSubmitting}
        >
          Transfer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
