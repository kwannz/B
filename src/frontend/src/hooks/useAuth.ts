import { useState, useCallback } from 'react';
import apiClient from '../api/client';

export interface User {
  id: string;
  email: string;
  username: string;
  roles: Array<{
    name: string;
    permissions: string[];
  }>;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  signup: (email: string, username: string, password: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthContext = (): AuthContextType => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = localStorage.getItem('token');
    return !!token;
  });

  const signup = useCallback(async (email: string, username: string, password: string) => {
    try {
      const response = await apiClient.post('/api/auth/signup', { email, username, password });
      if (response.success && response.data) {
        // Set user data
        const newUser: User = {
          id: username,
          email,
          username,
          roles: [{ name: 'backend_developer', permissions: ['execute_market_maker_trades'] }]
        };
        setUser(newUser);
        setIsAuthenticated(true);
        window.location.href = '/agent-selection';
        return true;
      }
      console.error('Signup failed:', response.error);
      return false;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      // Send the full email for login
      const response = await apiClient.post('/api/auth/login', { username: email, password });
      console.log('Login response:', response); // Debug log
      if (response.success && response.data) {
        // Store the JWT token
        localStorage.setItem('token', response.data.access_token);
        // Set user data using email as identifier
        const newUser: User = {
          id: email,
          email,
          username: email.split('@')[0],
          roles: [{ name: 'backend_developer', permissions: ['execute_market_maker_trades'] }]
        };
        setUser(newUser);
        setIsAuthenticated(true);
        return true;
      }
      console.error('Login failed:', response.error);
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return {
    user,
    isAuthenticated,
    login,
    signup,
    logout,
  };
};
