import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { initMetrics } from './utils/metrics';
import Dashboard from './pages/Dashboard';
import Trading from './pages/Trading';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

const App: React.FC = () => {
  useEffect(() => {
    // 初始化性能指标收集
    initMetrics();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/trading" element={<Trading />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </Router>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App; 