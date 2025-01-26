import React from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { useAuthContext } from '../hooks/useAuth';

// layouts
import MainLayout from '../layouts/MainLayout';

// pages
import HomePage from '../pages/HomePage';
import AgentSelection from '../pages/AgentSelection';
import { StrategyCreation } from '../pages/StrategyCreation';
import BotIntegration from '../pages/BotIntegration';
import KeyManagement from '../pages/KeyManagement';
import Dashboard from '../pages/Dashboard';
import Login from '../pages/Login';
import SignUp from '../pages/SignUp';

export default function Router() {
  const { isAuthenticated } = useAuthContext();

  return useRoutes([
    {
      path: '/',
      element: <MainLayout />,
      children: [
        { path: '/', element: <HomePage /> },
        { 
          path: '/agent-selection', 
          element: isAuthenticated ? <AgentSelection /> : <Navigate to="/login" /> 
        },
        { 
          path: '/strategy-creation', 
          element: isAuthenticated ? <StrategyCreation /> : <Navigate to="/login" /> 
        },
        { 
          path: '/bot-integration', 
          element: isAuthenticated ? <BotIntegration /> : <Navigate to="/login" /> 
        },
        { 
          path: '/key-management', 
          element: isAuthenticated ? <KeyManagement /> : <Navigate to="/login" /> 
        },
        { 
          path: '/trading-agent/*', 
          element: isAuthenticated ? <Dashboard agentType="trading" /> : <Navigate to="/login" /> 
        },
        { 
          path: '/defi-agent/*', 
          element: isAuthenticated ? <Dashboard agentType="defi" /> : <Navigate to="/login" /> 
        },
      ],
    },
    {
      path: '/login',
      element: !isAuthenticated ? <Login /> : <Navigate to="/agent-selection" />,
    },
    {
      path: '/signup',
      element: !isAuthenticated ? <SignUp /> : <Navigate to="/agent-selection" />,
    },
  ]);
}
