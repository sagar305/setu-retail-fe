import { ReactNode } from 'react';
import { Box, Container, AppBar, Toolbar, Typography, Button, Menu, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export const Layout = ({ children, title }: LayoutProps) => {
  const { auth, logout } = useAppStore();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleMenuClose();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'var(--color-background)' }}>
      {/* Header */}
      <AppBar
        position="sticky"
        sx={{
          backgroundColor: 'var(--color-primary)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 100,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1, sm: 2 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/')}>
            🏪 Setu
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {auth.user?.name}
            </Typography>
            <Button
              color="inherit"
              onClick={handleMenuOpen}
              sx={{ minWidth: 'auto', p: 0 }}
              startIcon={<MenuIcon />}
            >
              {auth.user?.role}
            </Button>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
              <MenuItem disabled>{auth.user?.email}</MenuItem>
              <MenuItem onClick={() => {
                navigate('/profile');
                handleMenuClose();
              }}>
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <Container
          maxWidth={false}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            p: { xs: 1, sm: 2 },
            maxWidth: '100%',
          }}
        >
          {title && <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>{title}</Typography>}
          {children}
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          bgcolor: 'var(--color-light)',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          p: 1,
          fontSize: 'var(--font-size-xs)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        Setu Retail POS v1.0 © 2026
      </Box>
    </Box>
  );
};
