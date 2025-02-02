import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const menuItems = [
    { path: '/', label: '仪表盘' },
    { path: '/trading', label: '交易' },
    { path: '/positions', label: '持仓' },
    { path: '/orders', label: '订单' },
    { path: '/settings', label: '设置' },
  ];

  return (
    <div className={`app-container ${theme}`}>
      <header className="header">
        <div className="logo">
          Trading Bot
        </div>
        <div className="user-info">
          {user ? (
            <>
              <span>{user.username}</span>
              <button onClick={logout}>登出</button>
            </>
          ) : (
            <Link to="/login">登录</Link>
          )}
          <button onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <div className="main-container">
        <nav className="sidebar">
          {menuItems.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={pathname === path ? 'active' : ''}
            >
              {label}
            </Link>
          ))}
        </nav>

        <main className="content">
          {children}
        </main>
      </div>

      <footer className="footer">
        <div>© 2024 Trading Bot. All rights reserved.</div>
      </footer>
    </div>
  );
};

export default Layout; 