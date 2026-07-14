import React from 'react';
import { Card, Typography } from '@mui/material';
import Layout from '../components/Layout';

const StockTransfer = () => {
  return (
    <Layout title="StockTransfer">
      <Card sx={{ padding: '24px' }}>
        <Typography variant="h6">StockTransfer</Typography>
        <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
          StockTransfer module - to be implemented
        </Typography>
      </Card>
    </Layout>
  );
};

export default StockTransfer;
