'use client';

import { Box, TextField, Button, CircularProgress } from '@mui/material';

interface StrategyFormProps {
  agentType: string;
  strategy: string;
  onStrategyChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export default function StrategyForm({
  agentType,
  strategy,
  onStrategyChange,
  onSubmit,
  onBack,
  isSubmitting
}: StrategyFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <TextField
        fullWidth
        multiline
        rows={4}
        label="Strategy Description"
        value={strategy}
        onChange={(e) => onStrategyChange(e.target.value)}
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
