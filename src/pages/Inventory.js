import React from 'react';
import { Card, Typography } from '@mui/material';
import Layout from '../components/Layout';

const Inventory = () => {
  return (
    <Layout title="Inventory">
      <Card sx={{ padding: '24px' }}>
        <Typography variant="h6">Inventory</Typography>
        <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
          Inventory module - to be implemented
        </Typography>
      </Card>
    </Layout>
  );
};

export default Inventory;
