'use client';

import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Card, CardContent, Alert } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAddress } from "@thirdweb-dev/react";

export default function StrategyCreation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const address = useAddress();
  const agentType = searchParams.get('type') || 'trading';
  
  const [strategy, setStrategy] = useState('');
  const [promotionWords, setPromotionWords] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strategy || !promotionWords) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      // API call will be implemented here
      router.push('/bot-integration');
    } catch (err) {
      setError('Failed to create strategy. Please try again.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Create Your Strategy
      </Typography>
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              label="Trading Strategy"
              multiline
              rows={4}
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              label="Promotion Words"
              multiline
              rows={2}
              value={promotionWords}
              onChange={(e) => setPromotionWords(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
            >
              Create Strategy
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
