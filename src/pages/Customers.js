import React from 'react';
import { Card, Typography } from '@mui/material';
import Layout from '../components/Layout';

const Customers = () => {
  return (
    <Layout title="Customers">
      <Card sx={{ padding: '24px' }}>
        <Typography variant="h6">Customers</Typography>
        <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
          Customers module - to be implemented
        </Typography>
      </Card>
    </Layout>
  );
};

export default Customers;
