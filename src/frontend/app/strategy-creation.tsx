import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { useAddress } from "@thirdweb-dev/react";

const StrategyCreation: React.FC = () => {
  const router = useRouter();
  const address = useAddress();
  const [strategy, setStrategy] = useState({
    name: '',
    type: 'trading',
    description: '',
    riskLevel: 'medium',
    targetReturn: '',
  });
  const [error, setError] = useState<string | null>(null);

  if (!address) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // API call to save strategy will be implemented here
      router.push('/bot-integration');
    } catch (err) {
      setError('Failed to create strategy. Please try again.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Create Trading Strategy
      </Typography>
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {error && (
                <Grid item xs={12}>
                  <Alert severity="error">{error}</Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Strategy Name"
                  value={strategy.name}
                  onChange={(e) => setStrategy({ ...strategy, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Strategy Type</InputLabel>
                  <Select
                    value={strategy.type}
                    label="Strategy Type"
                    onChange={(e) => setStrategy({ ...strategy, type: e.target.value })}
                  >
                    <MenuItem value="trading">Trading</MenuItem>
                    <MenuItem value="defi">DeFi</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Strategy Description"
                  value={strategy.description}
                  onChange={(e) => setStrategy({ ...strategy, description: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Risk Level</InputLabel>
                  <Select
                    value={strategy.riskLevel}
                    label="Risk Level"
                    onChange={(e) => setStrategy({ ...strategy, riskLevel: e.target.value })}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Target Return (%)"
                  type="number"
                  value={strategy.targetReturn}
                  onChange={(e) => setStrategy({ ...strategy, targetReturn: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  fullWidth
                >
                  Create Strategy
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StrategyCreation;
