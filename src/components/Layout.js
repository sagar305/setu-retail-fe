import React from 'react';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const Layout = ({ children, title, isOffline }) => {
  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>
        <TopBar title={title} isOffline={isOffline} />
        <Box
          sx={{
            flex: 1,
            backgroundColor: '#F5F3ED',
            padding: '20px',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
