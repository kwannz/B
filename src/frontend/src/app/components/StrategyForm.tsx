'use client';

import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import { Box, TextField, Button, CircularProgress, Typography } from '@mui/material';

interface StrategyFormProps {
  agentType: 'dexSwap' | 'memeCoin' | 'trading';
  strategy: string;
  onStrategyChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onBack: (e: MouseEvent<HTMLButtonElement>) => void;
  isSubmitting: boolean;
  // 交易参数
  maxPositionSize?: number;
  onMaxPositionSizeChange?: (value: number) => void;
  minProfitThreshold?: number;
  onMinProfitThresholdChange?: (value: number) => void;
  stopLossThreshold?: number;
  onStopLossThresholdChange?: (value: number) => void;
  orderTimeout?: number;
  onOrderTimeoutChange?: (value: number) => void;
  maxSlippage?: number;
  onMaxSlippageChange?: (value: number) => void;
  riskLevel?: 'low' | 'medium' | 'high';
  onRiskLevelChange?: (value: 'low' | 'medium' | 'high') => void;
  tradeSize?: number;
  onTradeSizeChange?: (value: number) => void;
  // DEX 特定参数
  slippageTolerance?: number;
  onSlippageChange?: (value: number) => void;
  // Meme币特定参数
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
  maxPositionSize = 1000,
  onMaxPositionSizeChange,
  minProfitThreshold = 0.02,
  onMinProfitThresholdChange,
  stopLossThreshold = 0.05,
  onStopLossThresholdChange,
  orderTimeout = 60,
  onOrderTimeoutChange,
  maxSlippage = 0.01,
  onMaxSlippageChange,
  riskLevel = 'medium',
  onRiskLevelChange,
  tradeSize = 2.5,
  onTradeSizeChange,
  slippageTolerance = 1.0,
  onSlippageChange,
  sentimentThreshold = 0.5,
  onSentimentChange
}: StrategyFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {agentType === 'trading' && (
        <Box className="space-y-4">
          <Typography variant="h6" className="mb-4">
            交易参数配置
          </Typography>
          
          <TextField
            fullWidth
            type="number"
            label="最大持仓规模"
            value={maxPositionSize}
            onChange={(e) => onMaxPositionSizeChange?.(Number(e.target.value))}
            inputProps={{ min: 100, max: 10000, step: 100 }}
            disabled={isSubmitting}
          />
          
          <TextField
            fullWidth
            type="number"
            label="最小利润阈值"
            value={minProfitThreshold}
            onChange={(e) => onMinProfitThresholdChange?.(Number(e.target.value))}
            inputProps={{ min: 0.01, max: 0.1, step: 0.01 }}
            disabled={isSubmitting}
          />
          
          <TextField
            fullWidth
            type="number"
            label="止损阈值"
            value={stopLossThreshold}
            onChange={(e) => onStopLossThresholdChange?.(Number(e.target.value))}
            inputProps={{ min: 0.01, max: 0.1, step: 0.01 }}
            disabled={isSubmitting}
          />
          
          <TextField
            fullWidth
            type="number"
            label="订单超时时间(秒)"
            value={orderTimeout}
            onChange={(e) => onOrderTimeoutChange?.(Number(e.target.value))}
            inputProps={{ min: 30, max: 300, step: 30 }}
            disabled={isSubmitting}
          />
          
          <TextField
            fullWidth
            type="number"
            label="最大滑点"
            value={maxSlippage}
            onChange={(e) => onMaxSlippageChange?.(Number(e.target.value))}
            inputProps={{ min: 0.001, max: 0.05, step: 0.001 }}
            disabled={isSubmitting}
          />
          
          <Box className="space-y-2">
            <Typography variant="subtitle2">风险等级</Typography>
            <Box className="flex gap-2">
              {['low', 'medium', 'high'].map((level) => (
                <Button
                  key={level}
                  variant={riskLevel === level ? 'contained' : 'outlined'}
                  onClick={() => onRiskLevelChange?.(level as 'low' | 'medium' | 'high')}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {level === 'low' ? '低' : level === 'medium' ? '中' : '高'}
                </Button>
              ))}
            </Box>
          </Box>
          
          <TextField
            fullWidth
            type="number"
            label="交易规模"
            value={tradeSize}
            onChange={(e) => onTradeSizeChange?.(Number(e.target.value))}
            inputProps={{ min: 0.1, max: 10, step: 0.1 }}
            disabled={isSubmitting}
          />
        </Box>
      )}

      {agentType === 'dexSwap' && (
        <TextField
          fullWidth
          type="number"
          label="滑点容忍度 (%)"
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
          label="情绪阈值"
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
