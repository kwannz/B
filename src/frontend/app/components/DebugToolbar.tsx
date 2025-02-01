import { Box, IconButton, Tooltip, Badge, SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material';
import { 
  BugReport, 
  Memory, 
  Timeline, 
  NetworkCheck, 
  Storage, 
  Download,
  Refresh,
  Clear,
  FilterList
} from '@mui/icons-material';
import { useDebug } from '../contexts/DebugContext';
import { useDebugStore } from '../stores/debugStore';
import { debugService } from '../services/DebugService';

export const DebugToolbar = () => {
  const { isDebugMode, toggleDebugMode, debugSummary, exportDebugLogs, clearDebugLogs } = useDebug();
  const debugStore = useDebugStore();

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

  const handleRefresh = () => {
    debugService.enableRealTimeDebugging();
  };

  const handleClear = () => {
    clearDebugLogs();
  };

  const actions = [
    { icon: <Memory />, name: 'System Metrics', action: () => debugStore.setFilters({ category: 'system' }) },
    { icon: <Timeline />, name: 'Market Data', action: () => debugStore.setFilters({ category: 'market' }) },
    { icon: <NetworkCheck />, name: 'Trading', action: () => debugStore.setFilters({ category: 'trading' }) },
    { icon: <Storage />, name: 'Wallet', action: () => debugStore.setFilters({ category: 'wallet' }) },
    { icon: <Download />, name: 'Export JSON', action: () => handleExport('json') },
    { icon: <Download />, name: 'Export CSV', action: () => handleExport('csv') },
    { icon: <Refresh />, name: 'Refresh', action: handleRefresh },
    { icon: <Clear />, name: 'Clear', action: handleClear },
    { icon: <FilterList />, name: 'Reset Filters', action: () => debugStore.setFilters({}) }
  ];

  if (!isDebugMode) {
    return (
      <Box sx={{ position: 'fixed', bottom: 16, right: 16 }}>
        <Tooltip title="Enable Debug Mode">
          <IconButton onClick={toggleDebugMode}>
            <BugReport />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
      <SpeedDial
        ariaLabel="Debug Tools"
        icon={
          <Badge
            badgeContent={debugSummary.error_count + debugSummary.warning_count}
            color={debugSummary.error_count > 0 ? 'error' : 'warning'}
          >
            <SpeedDialIcon icon={<BugReport />} />
          </Badge>
        }
        direction="up"
        FabProps={{
          sx: {
            bgcolor: 'background.paper',
            '&:hover': {
              bgcolor: 'background.paper'
            }
          }
        }}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.action}
          />
        ))}
      </SpeedDial>
    </Box>
  );
};
