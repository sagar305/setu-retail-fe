import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Drawer,
  Avatar,
  Typography,
  Button,
} from '@mui/material';
import {
  BarChart,
  ShoppingCart,
  Package,
  Boxes,
  FileText,
  ArrowRightLeft,
  Users,
  User,
  Settings,
  LogOut,
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart, section: 'Main' },
    { path: '/pos-billing', label: 'POS Billing', icon: ShoppingCart, section: 'Operations' },
    { path: '/weighing-counter', label: 'Weighing Counter', icon: Box, section: 'Operations' },
    { path: '/inventory', label: 'Inventory', icon: Boxes, section: 'Operations' },
    { path: '/product-master', label: 'Product Master', icon: Package, section: 'Catalog' },
    { path: '/categories', label: 'Categories', icon: Package, section: 'Catalog' },
    { path: '/product-availability', label: 'Product Availability', icon: Package, section: 'Catalog' },
    { path: '/purchase-orders', label: 'Purchase Orders', icon: FileText, section: 'Procurement' },
    { path: '/stock-transfer', label: 'Stock Transfer', icon: ArrowRightLeft, section: 'Procurement' },
    { path: '/customers', label: 'Customers', icon: Users, section: 'Management' },
    { path: '/outlets', label: 'Outlets', icon: Users, section: 'Management' },
    { path: '/employees', label: 'Employees', icon: User, section: 'Management' },
    { path: '/suppliers', label: 'Suppliers', icon: User, section: 'Management' },
    { path: '/settings', label: 'Settings', icon: Settings, section: 'Admin' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 230,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 230,
          boxSizing: 'border-box',
          backgroundColor: '#0E1124',
          color: '#F2EFE7',
          transition: 'width 0.3s',
        },
      }}
    >
      <Box
        sx={{
          p: 2,
          textAlign: 'center',
          borderBottom: '1px solid rgba(27,31,59,0.16)',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Setu.
        </Typography>
        <Typography variant="caption" sx={{ color: '#9AA0C0' }}>
          RETAIL POS
        </Typography>
      </Box>

      <List sx={{ flex: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <ListItem
              key={item.path}
              component={Link}
              to={item.path}
              sx={{
                backgroundColor: active ? '#1B1F3B' : 'transparent',
                borderLeft: active ? '3px solid #F2A03D' : '3px solid transparent',
                color: active ? '#F2EFE7' : '#9AA0C0',
                '&:hover': {
                  backgroundColor: '#1B1F3B',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: 'inherit',
                }}
              >
                <Icon size={20} />
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItem>
          );
        })}
      </List>

      <Box
        sx={{
          p: 2,
          borderTop: '1px solid rgba(27,31,59,0.16)',
          textAlign: 'center',
        }}
      >
        {user && (
          <>
            <Avatar sx={{ width: 48, height: 48, margin: '0 auto', mb: 1, backgroundColor: '#F2A03D' }}>
              {user.name?.charAt(0)}
            </Avatar>
            <Typography variant="body2">{user.name}</Typography>
            <Typography variant="caption" sx={{ color: '#9AA0C0' }}>
              Manager
            </Typography>
            <Button
              fullWidth
              variant="text"
              startIcon={<LogOut size={16} />}
              onClick={logout}
              sx={{ mt: 1, color: '#9AA0C0' }}
            >
              Logout
            </Button>
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default Sidebar;
