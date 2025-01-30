'use client';

import { Box, Typography, LinearProgress } from '@mui/material';

interface PerformanceMetricsProps {
  labelA: string;
  labelB: string;
  valueA: number;
  valueB: number;
  unit: string;
  label: string;
}

export default function PerformanceMetrics({
  labelA,
  labelB,
  valueA,
  valueB,
  unit,
  label,
}: PerformanceMetricsProps) {
  const total = Math.abs(valueA) + Math.abs(valueB);
  const progressA = total === 0 ? 50 : (Math.abs(valueA) / total) * 100;

  return (
    <Box className="space-y-2">
      <Typography variant="subtitle2" color="text.secondary" className="text-center">
        {label}
      </Typography>
      <Box className="flex items-center gap-4">
        <Typography variant="body2" className="w-20 text-right">
          {labelA}: {valueA}{unit}
        </Typography>
        <Box className="flex-1">
          <LinearProgress
            variant="determinate"
            value={progressA}
            className="h-2 rounded-full"
            classes={{
              bar1Determinate: valueA > valueB ? 'bg-green-500' : 'bg-gray-400'
            }}
          />
        </Box>
        <Typography variant="body2" className="w-20">
          {labelB}: {valueB}{unit}
        </Typography>
      </Box>
    </Box>
  );
}
