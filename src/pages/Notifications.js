import React from 'react';
import { Card, Typography } from '@mui/material';
import Layout from '../components/Layout';

const Notifications = () => {
  return (
    <Layout title="Notifications">
      <Card sx={{ padding: '24px' }}>
        <Typography variant="h6">Notifications</Typography>
        <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
          Notifications module - to be implemented
        </Typography>
      </Card>
    </Layout>
  );
};

export default Notifications;
