import React, { useState } from 'react';
import { Box, TextField, Button, Alert, Typography, Container, Card, CardContent, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../hooks/useAuth';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { signup } = useAuthContext();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const success = await signup(email, username, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Signup failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h5" component="h1" align="center" gutterBottom>
              Sign Up
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <form onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                helperText="Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character"
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={isLoading}
              >
                {isLoading ? 'Signing up...' : 'Sign Up'}
              </Button>
              <Box sx={{ textAlign: 'center' }}>
                <Link href="/login" variant="body2">
                  Already have an account? Sign in
                </Link>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default SignUp;
