import { useState } from 'react';
import { Box, Button, TextField, Typography, Card, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { authAPI } from '../services/api';

export const Login = () => {
  const navigate = useNavigate();
  const { setAuth, setLoading, loading, error, setError } = useAppStore();
  const [formData, setFormData] = useState({ email: '', password: '', tenantId: 'default' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await authAPI.login(formData.email, formData.password, formData.tenantId);
      setAuth({ token: data.token, user: data.user });
      navigate('/billing');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'var(--color-background)',
        p: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 400,
          p: 3,
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <Typography variant="h4" sx={{ textAlign: 'center', mb: 1, fontWeight: 700 }}>
          🏪 Setu Retail
        </Typography>
        <Typography variant="body2" sx={{ textAlign: 'center', mb: 3, color: 'var(--color-text-muted)' }}>
          POS System
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            margin="normal"
            required
            variant="outlined"
            disabled={loading}
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            margin="normal"
            required
            variant="outlined"
            disabled={loading}
          />

          <TextField
            fullWidth
            label="Tenant ID"
            name="tenantId"
            value={formData.tenantId}
            onChange={handleChange}
            margin="normal"
            variant="outlined"
            disabled={loading}
          />

          <Button
            fullWidth
            variant="contained"
            sx={{
              mt: 3,
              mb: 2,
              bgcolor: 'var(--color-primary)',
              color: 'white',
              py: 1.5,
              fontWeight: 600,
              '&:hover': { bgcolor: 'var(--color-tertiary)' },
              '&:disabled': { opacity: 0.6 },
            }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', mt: 2, color: 'var(--color-text-muted)' }}>
          Demo: email@example.com
        </Typography>
      </Card>
    </Box>
  );
};
