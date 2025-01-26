import { useState, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  username?: string;
  roles?: Array<{
    name: string;
    permissions: string[];
  }>;
}

export const useAuthContext = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const signup = useCallback(async (email: string, username: string, password: string) => {
    try {
      const response = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Signup failed:', errorData);
        return false;
      }

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      
      // Set user data
      const newUser: User = {
        id: username, // Temporary ID until we get proper ID from backend
        email,
        username,
        roles: [{ name: 'backend_developer', permissions: ['execute_market_maker_trades'] }]
      };
      setUser(newUser);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const formData = new FormData();
      formData.append('username', email);  // OAuth2 expects username field
      formData.append('password', password);

      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Login failed:', errorData);
        return false;
      }

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      
      // Set user data
      const newUser: User = {
        id: email.split('@')[0], // Temporary ID until we get proper ID from backend
        email,
        username: email.split('@')[0],
        roles: [{ name: 'backend_developer', permissions: ['execute_market_maker_trades'] }]
      };
      setUser(newUser);
      setIsAuthenticated(true);
      return true;
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
