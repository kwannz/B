'use client';

import { useState } from 'react';
import { Box, Paper, Typography, IconButton, Collapse, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import { BugReport, Close, ExpandMore, Download } from '@mui/icons-material';
import { LogLevel, DebugLog, useDebug } from '../contexts/DebugContext';

const severityColors: Record<LogLevel, 'default' | 'info' | 'warning' | 'error'> = {
  debug: 'default',
  info: 'info',
  warn: 'warning',
  error: 'error'
} as const;

export default function DebugPanel() {
  const [expanded, setExpanded] = useState(false);
  const { isDebugMode, toggleDebugMode, debugLogs, debugSummary, clearDebugLogs, exportDebugLogs } = useDebug();

  const handleExport = (format: 'json' | 'csv') => {
    const content = exportDebugLogs(format);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_logs.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isDebugMode) {
    return (
      <IconButton
        onClick={toggleDebugMode}
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
      >
        <BugReport />
      </IconButton>
    );
  }

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'relative',
        width: '100%',
        zIndex: 1000,
        transition: 'width 0.3s ease'
      }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReport />
          调试面板
          {debugSummary.error_count > 0 && (
            <Chip
              label={`${debugSummary.error_count} 错误`}
              color="error"
              size="small"
            />
          )}
          {debugSummary.warning_count > 0 && (
            <Chip
              label={`${debugSummary.warning_count} 警告`}
              color="warning"
              size="small"
            />
          )}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={() => handleExport('json')} size="small">
            <Download />
          </IconButton>
          <IconButton onClick={() => setExpanded(!expanded)} size="small">
            <ExpandMore sx={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
          </IconButton>
          <IconButton onClick={toggleDebugMode} size="small">
            <Close />
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <TableContainer sx={{ maxHeight: '60vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>时间</TableCell>
                <TableCell>级别</TableCell>
                <TableCell>类别</TableCell>
                <TableCell>消息</TableCell>
                <TableCell>数据</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {debugLogs.map((log: DebugLog, index: number) => (
                <TableRow key={index} hover>
                  <TableCell>
                    {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.level}
                      color={severityColors[log.level]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{log.category}</TableCell>
                  <TableCell>{log.message}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        m: 0,
                        p: 1,
                        bgcolor: 'grey.100',
                        borderRadius: 1,
                        overflow: 'auto',
                        maxWidth: '300px',
                        maxHeight: '100px'
                      }}
                    >
                      {JSON.stringify(log.data, null, 2)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Paper>
  );
}
