'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Chip
} from '@mui/material';
import { transferSOL, transferUSDT } from '@/app/api/client';

interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
  fromAddress: string;
  toAddress: string;
  fromLabel: string;
  toLabel: string;
  balance: {
    sol: number;
    usdt: number;
  };
  fees?: {
    sol: number;
    usdt: number;
  };
  onSuccess?: (txHash: string) => void;
}

type TokenType = 'SOL' | 'USDT';

export default function TransferDialog({
  open,
  onClose,
  fromAddress,
  toAddress,
  fromLabel,
  toLabel,
  balance,
  fees = { sol: 0.000005, usdt: 1 },
  onSuccess
}: TransferDialogProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenType>('SOL');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const maxAmount = selectedToken === 'SOL' ? balance.sol : balance.usdt;
  const minAmount = selectedToken === 'SOL' ? 0.01 : 1;
  const fee = selectedToken === 'SOL' ? fees.sol : fees.usdt;

  const validateAmount = (value: string): boolean => {
    const transferAmount = parseFloat(value);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setError('请输入有效金额');
      return false;
    }
    if (transferAmount > maxAmount) {
      setError('余额不足');
      return false;
    }
    if (transferAmount < minAmount) {
      setError(`最小转账金额为 ${minAmount} ${selectedToken}`);
      return false;
    }
    if (transferAmount + fee > maxAmount) {
      setError(`余额不足以支付转账费用 (${fee} ${selectedToken})`);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateAmount(amount)) return;
    
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const transferAmount = parseFloat(amount);
      let txHash;
      
      if (selectedToken === 'SOL') {
        txHash = await transferSOL(fromAddress, toAddress, transferAmount);
      } else {
        txHash = await transferUSDT(fromAddress, toAddress, transferAmount);
      }
      
      onSuccess?.(txHash);
      onClose();
    } catch (err) {
      console.error('Transfer failed:', err);
      setError(`转账${selectedToken}失败。请重试。`);
    } finally {
      setIsSubmitting(false);
      setShowConfirmation(false);
    }
  };

  const handleClose = () => {
    setShowConfirmation(false);
    setError(null);
    setAmount('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box className="flex justify-between items-center">
          <Typography variant="h6">转账{selectedToken}</Typography>
          <Chip 
            label={`手续费: ${fee} ${selectedToken}`}
            color="default"
            size="small"
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box className="space-y-4 py-4">
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {showConfirmation && (
            <Alert severity="warning">
              请确认转账信息是否正确。此操作不可撤销。
            </Alert>
          )}

          <Box className="space-y-2">
            <Typography variant="subtitle2" color="text.secondary">
              从: {fromLabel}
            </Typography>
            <Typography className="font-mono text-sm break-all bg-gray-50 p-2 rounded">
              {fromAddress}
            </Typography>
          </Box>

          <Box className="space-y-2">
            <Typography variant="subtitle2" color="text.secondary">
              至: {toLabel}
            </Typography>
            <Typography className="font-mono text-sm break-all bg-gray-50 p-2 rounded">
              {toAddress}
            </Typography>
          </Box>

          <FormControl fullWidth>
            <InputLabel>代币类型</InputLabel>
            <Select
              value={selectedToken}
              onChange={(e) => {
                setSelectedToken(e.target.value as TokenType);
                setAmount('');
                setError(null);
              }}
              disabled={isSubmitting}
              label="代币类型"
            >
              <MenuItem value="SOL">SOL</MenuItem>
              <MenuItem value="USDT">USDT</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label={`金额 (${selectedToken})`}
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            disabled={isSubmitting}
            inputProps={{
              min: minAmount,
              max: maxAmount,
              step: selectedToken === 'SOL' ? 0.01 : 1,
            }}
          />

          <Box className="flex justify-between items-center text-sm text-gray-500">
            <Typography variant="body2">
              可用余额: {maxAmount.toFixed(selectedToken === 'SOL' ? 4 : 2)} {selectedToken}
            </Typography>
            <Typography variant="body2">
              转账后余额: {amount ? (maxAmount - parseFloat(amount) - fee).toFixed(selectedToken === 'SOL' ? 4 : 2) : maxAmount.toFixed(selectedToken === 'SOL' ? 4 : 2)} {selectedToken}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!amount || isSubmitting}
          color={showConfirmation ? 'warning' : 'primary'}
        >
          {showConfirmation ? '确认转账' : '转账'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
