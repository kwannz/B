# Visualization Components

This directory contains reusable visualization components for the trading bot frontend.

## Directory Structure

- `charts/` - Trading and market data charts
- `indicators/` - Technical indicator visualizations
- `heatmaps/` - Market heatmap components
- `common/` - Shared visualization utilities

## Component Guidelines

1. Use React functional components with TypeScript
2. Implement responsive design for all visualizations
3. Support both light and dark themes
4. Include performance optimization (useMemo, useCallback)
5. Add comprehensive prop documentation

## Example Usage

```typescript
import React from 'react';
import { TradingChart } from './charts/TradingChart';
import { ChartData } from './types';

interface Props {
  data: ChartData;
  timeframe: string;
  indicators: string[];
  theme: 'light' | 'dark';
}

export const MarketView: React.FC<Props> = ({
  data,
  timeframe,
  indicators,
  theme
}) => {
  return (
    <TradingChart
      data={data}
      timeframe={timeframe}
      indicators={indicators}
      theme={theme}
    />
  );
};
``` 