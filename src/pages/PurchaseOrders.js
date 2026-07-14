import React from 'react';
import { Card, Typography } from '@mui/material';
import Layout from '../components/Layout';

const PurchaseOrders = () => {
  return (
    <Layout title="PurchaseOrders">
      <Card sx={{ padding: '24px' }}>
        <Typography variant="h6">PurchaseOrders</Typography>
        <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
          PurchaseOrders module - to be implemented
        </Typography>
      </Card>
    </Layout>
  );
};

export default PurchaseOrders;
