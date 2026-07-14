import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  Menu,
  MenuItem,
  Badge,
  TextField,
  Alert,
  IconButton,
} from '@mui/material';
import { Bell, ChevronDown, AlertCircle, X } from 'lucide-react';

const TopBar = ({ title = 'Dashboard', isOffline = false }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [outlet, setOutlet] = useState('MG Road (HQ)');
  const [showOfflineAlert, setShowOfflineAlert] = useState(isOffline);

  const handleOutletChange = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleOutletSelect = (outletName) => {
    setOutlet(outletName);
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
              {outlet}
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem onClick={() => handleOutletSelect('MG Road (HQ)')}>
                MG Road (HQ)
              </MenuItem>
              <MenuItem onClick={() => handleOutletSelect('Indiranagar')}>
                Indiranagar
              </MenuItem>
              <MenuItem onClick={() => handleOutletSelect('Whitefield')}>
                Whitefield
              </MenuItem>
            </Menu>

            <Button
              variant="text"
              sx={{
                minWidth: 'auto',
                padding: 0,
                color: '#0E1124',
              }}
            >
              <Badge badgeContent={3} color="error">
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
              RK
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
    </>
  );
};

export default TopBar;
