import React from 'react';
import { Card, Typography } from '@mui/material';
import Layout from '../components/Layout';

const Expenses = () => {
  return (
    <Layout title="Expenses">
      <Card sx={{ padding: '24px' }}>
        <Typography variant="h6">Expenses</Typography>
        <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
          Expenses module - to be implemented
        </Typography>
      </Card>
    </Layout>
  );
};

export default Expenses;
