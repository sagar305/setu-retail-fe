import React from 'react';
import { Card, Typography } from '@mui/material';
import Layout from '../components/Layout';

const Reports = () => {
  return (
    <Layout title="Reports">
      <Card sx={{ padding: '24px' }}>
        <Typography variant="h6">Reports</Typography>
        <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
          Reports module - to be implemented
        </Typography>
      </Card>
    </Layout>
  );
};

export default Reports;
