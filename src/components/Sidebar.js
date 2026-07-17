import React, { useState } from 'react';
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
  IconButton,
  Tooltip,
  Divider,
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
  Scale,
  Receipt,
  TrendingUp,
  Bell,
  Shield,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const EXPANDED_WIDTH = 230;
const COLLAPSED_WIDTH = 72;

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === '1'
  );

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebarCollapsed', prev ? '0' : '1');
      return !prev;
    });
  };

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart, section: 'Main' },
    { path: '/pos-billing', label: 'POS Billing', icon: ShoppingCart, section: 'Operations' },
    { path: '/weighing-counter', label: 'Weighing Counter', icon: Scale, section: 'Operations' },
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
    { path: '/expenses', label: 'Expenses', icon: Receipt, section: 'Finance' },
    { path: '/reports', label: 'Reports', icon: TrendingUp, section: 'Finance' },
    { path: '/notifications', label: 'Notifications', icon: Bell, section: 'Admin' },
    { path: '/roles-permissions', label: 'Roles & Permissions', icon: Shield, section: 'Admin' },
    { path: '/settings', label: 'Settings', icon: Settings, section: 'Admin' },
  ];

  const isActive = (path) => location.pathname === path;
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        transition: 'width 0.25s ease',
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          backgroundColor: '#0E1124',
          color: '#F2EFE7',
          transition: 'width 0.25s ease',
          overflowX: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          p: collapsed ? 1 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid rgba(27,31,59,0.16)',
          minHeight: 64,
        }}
      >
        {!collapsed && (
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              Setu.
            </Typography>
            <Typography variant="caption" sx={{ color: '#9AA0C0' }}>
              RETAIL POS
            </Typography>
          </Box>
        )}
        <Tooltip title={collapsed ? 'Expand menu' : 'Collapse menu'} placement="right">
          <IconButton onClick={toggleCollapsed} size="small" sx={{ color: '#9AA0C0' }}>
            {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
          </IconButton>
        </Tooltip>
      </Box>

      <List
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          pt: 0,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#1B1F3B', borderRadius: 3 },
        }}
      >
        {menuItems.map((item, idx) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const newSection = idx === 0 || menuItems[idx - 1].section !== item.section;
          return (
            <React.Fragment key={item.path}>
              {newSection && !collapsed && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    px: 2,
                    pt: idx === 0 ? 1.5 : 2,
                    pb: 0.5,
                    color: '#5F6478',
                    fontWeight: 700,
                    fontSize: '10px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  {item.section}
                </Typography>
              )}
              {newSection && collapsed && idx !== 0 && (
                <Divider sx={{ borderColor: 'rgba(154,160,192,0.15)', mx: 1.5, my: 0.75 }} />
              )}
              <Tooltip title={collapsed ? item.label : ''} placement="right">
                <ListItem
                  component={Link}
                  to={item.path}
                  sx={{
                    py: 0.75,
                    px: collapsed ? 0 : 2,
                    justifyContent: collapsed ? 'center' : 'flex-start',
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
                      minWidth: collapsed ? 0 : 36,
                      justifyContent: 'center',
                      color: 'inherit',
                    }}
                  >
                    <Icon size={collapsed ? 20 : 18} />
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '13.5px' }} />
                  )}
                </ListItem>
              </Tooltip>
            </React.Fragment>
          );
        })}
      </List>

      <Box
        sx={{
          p: collapsed ? 1 : 2,
          borderTop: '1px solid rgba(27,31,59,0.16)',
          textAlign: 'center',
        }}
      >
        {user && (
          <>
            <Tooltip title={collapsed ? `${user.name} (${user.role?.name || user.role || 'User'})` : ''} placement="right">
              <Avatar
                sx={{
                  width: collapsed ? 36 : 48,
                  height: collapsed ? 36 : 48,
                  margin: '0 auto',
                  mb: collapsed ? 0.5 : 1,
                  backgroundColor: '#F2A03D',
                  fontSize: collapsed ? 15 : 20,
                }}
              >
                {user.name?.charAt(0)}
              </Avatar>
            </Tooltip>
            {!collapsed && (
              <>
                <Typography variant="body2">{user.name}</Typography>
                <Typography variant="caption" sx={{ color: '#9AA0C0', textTransform: 'capitalize' }}>
                  {user.role?.name || user.role || 'User'}
                </Typography>
              </>
            )}
            {collapsed ? (
              <Tooltip title="Logout" placement="right">
                <IconButton onClick={logout} size="small" sx={{ color: '#9AA0C0', mt: 0.5 }}>
                  <LogOut size={18} />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                fullWidth
                variant="text"
                startIcon={<LogOut size={16} />}
                onClick={logout}
                sx={{ mt: 1, color: '#9AA0C0' }}
              >
                Logout
              </Button>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default Sidebar;
