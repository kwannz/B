'use client';

import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import { Box, TextField, Button, CircularProgress } from '@mui/material';

interface StrategyFormProps {
  agentType: 'dexSwap' | 'memeCoin';
  strategy: string;
  onStrategyChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onBack: (e: MouseEvent<HTMLButtonElement>) => void;
  isSubmitting: boolean;
  slippageTolerance?: number;
  onSlippageChange?: (value: number) => void;
  sentimentThreshold?: number;
  onSentimentChange?: (value: number) => void;
}

export default function StrategyForm({
  agentType,
  strategy,
  onStrategyChange,
  onSubmit,
  onBack,
  isSubmitting,
  slippageTolerance = 1.0,
  onSlippageChange,
  sentimentThreshold = 0.5,
  onSentimentChange
}: StrategyFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {agentType === 'dexSwap' && (
        <TextField
          fullWidth
          type="number"
          label="Slippage Tolerance (%)"
          value={slippageTolerance}
          onChange={(e) => onSlippageChange?.(Number(e.target.value))}
          inputProps={{ min: 0.1, max: 5.0, step: 0.1 }}
          disabled={isSubmitting}
        />
      )}
      
      {agentType === 'memeCoin' && (
        <TextField
          fullWidth
          type="number"
          label="Sentiment Threshold"
          value={sentimentThreshold}
          onChange={(e) => onSentimentChange?.(Number(e.target.value))}
          inputProps={{ min: 0, max: 1, step: 0.1 }}
          disabled={isSubmitting}
        />
      )}

      <TextField
        fullWidth
        multiline
        rows={4}
        label="Strategy Description"
        value={strategy}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onStrategyChange(e.target.value)}
        placeholder={`Describe your ${agentType} strategy...`}
        disabled={isSubmitting}
      />

      <Box className="flex gap-4">
        <Button
          variant="outlined"
          onClick={onBack}
          size="large"
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          disabled={!strategy || isSubmitting}
          className="flex-1 relative"
        >
          {isSubmitting ? (
            <>
              <CircularProgress size={24} className="absolute" />
              <span className="opacity-0">Continue</span>
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </Box>
    </form>
  );
}
