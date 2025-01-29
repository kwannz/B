import React from 'react';
import { Box, Snackbar, Alert } from '@mui/material';

export const Toaster = () => {
  return (
    <Box>
      <Snackbar open={false}>
        <Alert severity="success">Test Message</Alert>
      </Snackbar>
    </Box>
  );
};
