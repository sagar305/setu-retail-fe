import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  Link as MUILink,
  Alert,
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('Please enter email and password');
        setLoading(false);
        return;
      }
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Login failed - please check your email and password'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        backgroundColor: '#0E1124',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        sx={{
          width: '400px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          borderRadius: '16px',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Setu Retail POS
          </Typography>
          <Typography variant="body2" sx={{ color: '#5F6478' }}>
            Point of Sale System
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
            variant="outlined"
            size="small"
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            variant="outlined"
            size="small"
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', my: 2 }}>
            <Box>
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe" style={{ marginLeft: '8px', fontSize: '13px' }}>
                Remember me
              </label>
            </Box>
            <MUILink href="/forgot-password" sx={{ fontSize: '13px' }}>
              Forgot password?
            </MUILink>
          </Box>

          <Button
            fullWidth
            variant="contained"
            type="submit"
            sx={{
              backgroundColor: '#1B1F3B',
              color: '#FFF',
              fontWeight: 600,
              mb: 2,
              '&:hover': {
                backgroundColor: '#26306B',
              },
            }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        <Typography variant="body2" sx={{ textAlign: 'center' }}>
          Don't have an account?{' '}
          <MUILink component={Link} to="/signup" sx={{ fontWeight: 600 }}>
            Sign up
          </MUILink>
        </Typography>
      </Card>
    </Box>
  );
};

export default Login;
