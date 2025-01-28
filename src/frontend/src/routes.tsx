import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';

interface PrivateRouteProps {
  element: React.ReactElement;
}

function PrivateRoute({ element }: PrivateRouteProps) {
  const isAuthenticated = true; // TODO: Replace with actual auth check
  return isAuthenticated ? element : <Navigate to="/login" />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route 
          path="/" 
          element={<PrivateRoute element={<Dashboard agentType="trading" />} />} 
        />
        <Route 
          path="/defi" 
          element={<PrivateRoute element={<Dashboard agentType="defi" />} />} 
        />
      </Routes>
    </Suspense>
  );
}
