import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ textAlign: 'center', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Welcome to Trading Bot Platform
      </Typography>
      <Typography variant="body1" sx={{ mb: 4 }}>
        Start trading with our intelligent agents
      </Typography>
      <Button 
        variant="contained" 
        color="primary"
        onClick={() => navigate('/agent-selection')}
      >
        Get Started
      </Button>
    </Box>
  );
};

export default HomePage;
