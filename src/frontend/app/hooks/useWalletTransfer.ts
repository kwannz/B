import { useState } from 'react';
import { transferSOL, ApiError, TransferResult } from '../api/client';

export const useWalletTransfer = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);

  const transfer = async (fromAddress: string, toAddress: string, amount: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await transferSOL(fromAddress, toAddress, amount);
      setResult(data);
      return data;
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setResult(null);
  };

  return {
    transfer,
    reset,
    isLoading,
    error,
    result
  };
};
