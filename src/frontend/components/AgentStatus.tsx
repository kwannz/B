import type { FC, ReactNode } from 'react';
import { Card, CardContent, Typography, Grid, Box, Chip } from '@mui/material';
import { 
  TrendingUp, 
  Psychology, 
  Insights, 
  Assessment, 
  Analytics, 
  SecurityRounded, 
  AccountBalance 
} from '@mui/icons-material';

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error';
  icon: ReactNode;
  description: string;
}

const agents: Agent[] = [
  {
    id: 'market-analyst',
    name: 'Market Data Analyst',
    status: 'active',
    icon: <TrendingUp />,
    description: 'Collects and preprocesses market data'
  },
  {
    id: 'valuation',
    name: 'Valuation Agent',
    status: 'active',
    icon: <Assessment />,
    description: 'Calculates token intrinsic value'
  },
  {
    id: 'sentiment',
    name: 'Sentiment Agent',
    status: 'active',
    icon: <Psychology />,
    description: 'Analyzes market sentiment'
  },
  {
    id: 'fundamentals',
    name: 'Fundamentals Agent',
    status: 'idle',
    icon: <Insights />,
    description: 'Analyzes fundamental data'
  },
  {
    id: 'technical',
    name: 'Technical Analyst',
    status: 'active',
    icon: <Analytics />,
    description: 'Analyzes technical indicators'
  },
  {
    id: 'risk',
    name: 'Risk Manager',
    status: 'active',
    icon: <SecurityRounded />,
    description: 'Calculates risk metrics'
  },
  {
    id: 'portfolio',
    name: 'Portfolio Manager',
    status: 'active',
    icon: <AccountBalance />,
    description: 'Makes final trading decisions'
  }
];

const getStatusColor = (status: Agent['status']) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'idle':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
};

const AgentStatus: FC = () => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Trading Agents Status</Typography>
        <Grid container spacing={2}>
          {agents.map((agent) => (
            <Grid item xs={12} sm={6} md={4} key={agent.id}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: 'background.paper',
                boxShadow: 1
              }}>
                <Box sx={{ color: 'primary.main' }}>
                  {agent.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2">{agent.name}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {agent.description}
                  </Typography>
                </Box>
                <Chip 
                  size="small"
                  label={agent.status}
                  color={getStatusColor(agent.status)}
                  sx={{ textTransform: 'capitalize' }}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default AgentStatus;
