import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  Menu,
  MenuItem,
  Badge,
  Alert,
  IconButton,
} from '@mui/material';
import { Bell, ChevronDown, X } from 'lucide-react';
import { OutletContext } from '../context/OutletContext';
import { AuthContext } from '../context/AuthContext';
import OfflineSyncStatus from './OfflineSyncStatus';
import api from '../services/api';

const TopBar = ({ title = 'Dashboard', isOffline = false }) => {
  const { outlets, selectedOutlet, selectOutlet } = useContext(OutletContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [showOfflineAlert, setShowOfflineAlert] = useState(isOffline);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/notifications')
      .then((response) => {
        if (!cancelled) setUnreadCount(response.data.unread || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const getInitials = (name) =>
    (name || 'User')
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const handleOutletChange = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleOutletSelect = (outlet) => {
    selectOutlet(outlet);
    setAnchorEl(null);
  };

  return (
    <>
      {showOfflineAlert && (
        <Alert
          severity="error"
          sx={{ mb: 0, backgroundColor: '#C24A3D', color: '#FFF' }}
          action={
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setShowOfflineAlert(false)}
            >
              <X size={16} />
            </IconButton>
          }
        >
          You're offline — sales are being saved locally. Syncing 3 pending bills once connection returns.
          <Button size="small" sx={{ ml: 2, color: '#FFF', textDecoration: 'underline' }}>
            View details
          </Button>
        </Alert>
      )}
      <AppBar
        position="static"
        sx={{
          backgroundColor: '#FFF',
          color: '#0E1124',
          boxShadow: '0 1px 3px rgba(27,31,59,0.08)',
          borderBottom: '1px solid rgba(27,31,59,0.08)',
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '16px 24px',
          }}
        >
          <Box>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{title}</h1>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <OfflineSyncStatus />
            {selectedOutlet && (
              <Button
                variant="outlined"
                endIcon={<ChevronDown size={16} />}
                onClick={handleOutletChange}
                sx={{
                  borderColor: 'rgba(27,31,59,0.08)',
                  color: '#0E1124',
                  '&:hover': {
                    borderColor: 'rgba(27,31,59,0.16)',
                  },
                }}
              >
                {selectedOutlet.name}
              </Button>
            )}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              {outlets.map((outlet) => (
                <MenuItem key={outlet._id} onClick={() => handleOutletSelect(outlet)}>
                  {outlet.name} ({outlet.city})
                </MenuItem>
              ))}
            </Menu>

            <Button
              variant="text"
              onClick={() => navigate('/notifications')}
              sx={{
                minWidth: 'auto',
                padding: 0,
                color: '#0E1124',
              }}
            >
              <Badge color="error" badgeContent={unreadCount} max={9}>
                <Bell size={20} />
              </Badge>
            </Button>

            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#F2A03D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#FFF',
              }}
            >
              {getInitials(user?.name)}
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
    </>
  );
};

export default TopBar;
