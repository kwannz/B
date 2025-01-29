import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography } from '@mui/material';

const StrategyCreation = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    promotionWords: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('strategyData', JSON.stringify(formData));
      navigate('/bot-integration');
    } catch (error) {
      console.error('Failed to create strategy:', error);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 4 }}>
      <Typography variant="h4">Create Strategy</Typography>
      <Box sx={{ mt: 4 }}>
        <TextField
          fullWidth
          label="Strategy Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Promotion Words"
          value={formData.promotionWords}
          onChange={(e) => setFormData({ ...formData, promotionWords: e.target.value })}
          sx={{ mb: 2 }}
        />
        <Button type="submit" variant="contained">Create Strategy</Button>
      </Box>
    </Box>
  );
};

export default StrategyCreation;
