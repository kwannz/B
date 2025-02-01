'use client';

import React from 'react';
import { 
  Box, 
  SpeedDial, 
  SpeedDialAction, 
  SpeedDialIcon,
  Tooltip,
  Badge
} from '@mui/material';
import {
  BugReport,
  Memory,
  Timeline,
  Download,
  Refresh,
  Warning,
  Error as ErrorIcon,
  ClearAll
} from '@mui/icons-material';
import { useDebug } from '../contexts/DebugContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function DebugToolbar() {
  const { 
    isDebugMode,
    toggleDebugMode,
    debugSummary,
    clearDebugLogs,
    exportDebugLogs
  } = useDebug();

  const { language } = useLanguage();

  const actions = [
    {
      icon: (
        <Badge 
          badgeContent={debugSummary.error_count} 
          color="error"
          max={99}
        >
          <ErrorIcon />
        </Badge>
      ),
      name: language === 'zh' ? '错误' : 'Errors',
      tooltip: language === 'zh' ? `${debugSummary.error_count} 个错误` : `${debugSummary.error_count} Errors`,
      onClick: () => {/* 显示错误列表 */}
    },
    {
      icon: (
        <Badge 
          badgeContent={debugSummary.warning_count} 
          color="warning"
          max={99}
        >
          <Warning />
        </Badge>
      ),
      name: language === 'zh' ? '警告' : 'Warnings',
      tooltip: language === 'zh' ? `${debugSummary.warning_count} 个警告` : `${debugSummary.warning_count} Warnings`,
      onClick: () => {/* 显示警告列表 */}
    },
    {
      icon: <Memory />,
      name: language === 'zh' ? '性能指标' : 'Metrics',
      tooltip: language === 'zh' ? '查看性能指标' : 'View Performance Metrics',
      onClick: () => {/* 显示性能指标 */}
    },
    {
      icon: <Timeline />,
      name: language === 'zh' ? '趋势图' : 'Trends',
      tooltip: language === 'zh' ? '查看趋势图' : 'View Trends',
      onClick: () => {/* 显示趋势图 */}
    },
    {
      icon: <Download />,
      name: language === 'zh' ? '导出日志' : 'Export Logs',
      tooltip: language === 'zh' ? '导出调试日志' : 'Export Debug Logs',
      onClick: () => {
        exportDebugLogs('json');
      }
    },
    {
      icon: <ClearAll />,
      name: language === 'zh' ? '清除日志' : 'Clear Logs',
      tooltip: language === 'zh' ? '清除所有日志' : 'Clear All Logs',
      onClick: clearDebugLogs
    },
    {
      icon: <Refresh />,
      name: language === 'zh' ? '刷新' : 'Refresh',
      tooltip: language === 'zh' ? '刷新调试信息' : 'Refresh Debug Info',
      onClick: () => {
        window.location.reload();
      }
    }
  ];

  if (!isDebugMode) return null;

  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
      <SpeedDial
        ariaLabel="Debug Toolbar"
        icon={<SpeedDialIcon icon={<BugReport />} />}
        direction="up"
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={
              <Tooltip title={action.tooltip}>
                {action.icon}
              </Tooltip>
            }
            tooltipTitle={action.name}
            onClick={action.onClick}
          />
        ))}
      </SpeedDial>
    </Box>
  );
}
