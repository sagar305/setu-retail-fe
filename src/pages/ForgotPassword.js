import React, { useState } from 'react';
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
import api from '../services/api';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccess(response.data.message || 'Password reset link sent to your email');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset link');
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
            Reset your password
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
            variant="outlined"
            size="small"
          />

          <Button
            fullWidth
            variant="contained"
            type="submit"
            sx={{
              backgroundColor: '#1B1F3B',
              color: '#FFF',
              fontWeight: 600,
              mt: 3,
              mb: 2,
              '&:hover': {
                backgroundColor: '#26306B',
              },
            }}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Remember your password?{' '}
            <MUILink component={Link} to="/login" sx={{ fontWeight: 600 }}>
              Back to Login
            </MUILink>
          </Typography>
          <Typography variant="body2">
            Don't have an account?{' '}
            <MUILink component={Link} to="/signup" sx={{ fontWeight: 600 }}>
              Sign Up
            </MUILink>
          </Typography>
        </Box>
      </Card>
    </Box>
  );
};

export default ForgotPassword;
