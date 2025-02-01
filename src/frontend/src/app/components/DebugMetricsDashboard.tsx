'use client';

import React from 'react';
import { Box, Grid, Typography, Card, CardContent, Tabs, Tab } from '@mui/material';
import { useDebug } from '../contexts/DebugContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useState } from 'react';
import DebugMetrics from './DebugMetrics';
import DebugMetricsChart from './DebugMetricsChart';
import DebugPanel from './DebugPanel';
import ModelDebugInfo from './ModelDebugInfo';
import SystemDebugInfo from './SystemDebugInfo';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`debug-tabpanel-${index}`}
      aria-labelledby={`debug-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function DebugMetricsDashboard() {
  const { isDebugMode } = useDebug();
  const { language } = useLanguage();
  const [currentTab, setCurrentTab] = useState(0);

  if (!isDebugMode) return null;

  return (
    <Box className="p-4">
      <Box className="flex justify-between items-center mb-4">
        <Typography variant="h5">
          {language === 'zh' ? '调试指标面板' : 'Debug Metrics Dashboard'}
        </Typography>
        <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
          <Tab label={language === 'zh' ? '系统' : 'System'} />
          <Tab label={language === 'zh' ? '模型' : 'Model'} />
          <Tab label={language === 'zh' ? '性能' : 'Performance'} />
          <Tab label={language === 'zh' ? '日志' : 'Logs'} />
        </Tabs>
      </Box>

      <TabPanel value={currentTab} index={0}>
        <SystemDebugInfo />
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        <ModelDebugInfo />
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <DebugMetrics />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <DebugMetricsChart />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={currentTab} index={3}>
        <DebugPanel />
      </TabPanel>
    </Box>
  );
}
