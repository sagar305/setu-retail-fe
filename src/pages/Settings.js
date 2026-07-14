import React from 'react';
import { Card, Typography } from '@mui/material';
import Layout from '../components/Layout';

const Settings = () => {
  return (
    <Layout title="Settings">
      <Card sx={{ padding: '24px' }}>
        <Typography variant="h6">Settings</Typography>
        <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
          Settings module - to be implemented
        </Typography>
      </Card>
    </Layout>
  );
};

export default Settings;
