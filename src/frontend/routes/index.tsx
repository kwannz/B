import React from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { useAddress } from "@thirdweb-dev/react";

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

export default function Router() {
  const address = useAddress();
  const isAuthenticated = !!address;

  console.log('Routes rendering, auth state:', { isAuthenticated, pathname: window.location.pathname });
  
  return useRoutes([
    {
      path: '/',
      element: <MainLayout />,
      children: [
        { path: 'login', element: !isAuthenticated ? <Login /> : <Navigate to="/agent-selection" /> },
        { index: true, element: !isAuthenticated ? <Navigate to="/login" /> : <HomePage /> },
        { 
          path: 'agent-selection', 
          element: isAuthenticated ? <AgentSelection /> : <Navigate to="/login" /> 
        },
        { 
          path: 'strategy-creation', 
          element: isAuthenticated ? <StrategyCreation /> : <Navigate to="/login" /> 
        },
        { 
          path: 'bot-integration', 
          element: isAuthenticated ? <BotIntegration /> : <Navigate to="/login" /> 
        },
        { 
          path: 'key-management', 
          element: isAuthenticated ? <KeyManagement /> : <Navigate to="/login" /> 
        },
        { 
          path: 'trading-agent/*', 
          element: isAuthenticated ? <Dashboard agentType="trading" /> : <Navigate to="/login" /> 
        },
        { 
          path: 'defi-agent/*', 
          element: isAuthenticated ? <Dashboard agentType="defi" /> : <Navigate to="/login" /> 
        },
      ],
    },
    // Removed duplicate login route
  ]);
}
