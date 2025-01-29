import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';

const AgentSelection = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4">Select Your Agent</Typography>
      <Box sx={{ mt: 4 }}>
        <Button 
          variant="contained" 
          onClick={() => navigate('/strategy-creation', { state: { agentType: 'trading' } })}
        >
          Trading Agent
        </Button>
      </Box>
    </Box>
  );
};

export default AgentSelection;
