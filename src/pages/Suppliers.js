import React from 'react';
import { Card, Typography } from '@mui/material';
import Layout from '../components/Layout';

const Suppliers = () => {
  return (
    <Layout title="Suppliers">
      <Card sx={{ padding: '24px' }}>
        <Typography variant="h6">Suppliers</Typography>
        <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
          Suppliers module - to be implemented
        </Typography>
      </Card>
    </Layout>
  );
};

export default Suppliers;
