'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Alert, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { useAddress } from "@thirdweb-dev/react";

interface RiskEvent {
  timestamp: string;
  type: 'warning' | 'error' | 'critical';
  message: string;
  details: string;
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeAgents: number;
  pendingTrades: number;
  failedTrades: number;
  modelLatency: number;
}

export default function DeveloperDashboard() {
  const address = useAddress();
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // API calls will be implemented here
        const mockMetrics = {
          cpuUsage: 45.5,
          memoryUsage: 68.2,
          activeAgents: 3,
          pendingTrades: 5,
          failedTrades: 1,
          modelLatency: 250,
        };
        const mockRiskEvents = [
          {
            timestamp: '2024-02-20 15:30:45',
            type: 'warning',
            message: 'High model latency detected',
            details: 'Model response time exceeded 200ms threshold',
          },
          {
            timestamp: '2024-02-20 15:25:12',
            type: 'error',
            message: 'Trade execution failed',
            details: 'Insufficient balance for transaction',
          },
        ];
        setMetrics(mockMetrics);
        setRiskEvents(mockRiskEvents);
      } catch (err) {
        setError('Failed to fetch system metrics');
      } finally {
        setIsLoading(false);
      }
    };

    if (address) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [address]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Developer Dashboard
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Health
              </Typography>
              <Grid container spacing={2}>
                {metrics && (
                  <>
                    <Grid item xs={6} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        CPU Usage
                      </Typography>
                      <Typography variant="h6">
                        {metrics.cpuUsage.toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        Memory Usage
                      </Typography>
                      <Typography variant="h6">
                        {metrics.memoryUsage.toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        Active Agents
                      </Typography>
                      <Typography variant="h6">
                        {metrics.activeAgents}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        Pending Trades
                      </Typography>
                      <Typography variant="h6">
                        {metrics.pendingTrades}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        Failed Trades
                      </Typography>
                      <Typography variant="h6" color="error.main">
                        {metrics.failedTrades}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        Model Latency
                      </Typography>
                      <Typography variant="h6">
                        {metrics.modelLatency}ms
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risk Events
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Message</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {riskEvents.map((event, index) => (
                      <TableRow key={index}>
                        <TableCell>{event.timestamp}</TableCell>
                        <TableCell>
                          <Typography
                            color={
                              event.type === 'critical'
                                ? 'error.main'
                                : event.type === 'error'
                                ? 'warning.main'
                                : 'info.main'
                            }
                          >
                            {event.type.toUpperCase()}
                          </Typography>
                        </TableCell>
                        <TableCell>{event.message}</TableCell>
                        <TableCell>{event.details}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
