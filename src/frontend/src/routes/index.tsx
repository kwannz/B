import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import Login from '../pages/Login';
import { useAuthContext } from '../contexts/AuthContext';
import { FC, ReactNode } from 'react';
import { Box } from '@mui/material';

const ProtectedRoute: FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuthContext();
  if (!auth || !auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AppRoutes: FC = () => {
  const auth = useAuthContext();
  if (!auth) return null;
  const { isAuthenticated } = auth;

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Box sx={{ width: '100%', height: '100vh' }}>
              <Login />
            </Box>
          )
        } 
      />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Box sx={{ width: '100%', height: '100vh' }}>
              <HomePage />
            </Box>
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
