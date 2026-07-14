import React from 'react';
import { Box, Card, Typography, Grid } from '@mui/material';
import Layout from '../components/Layout';
import { TrendingUp } from 'lucide-react';

const StatCard = ({ label, value, change }) => (
  <Card
    sx={{
      padding: '24px',
      backgroundColor: '#FFFFFF',
      borderRadius: '9px',
      boxShadow: '0 1px 3px rgba(27,31,59,0.08)',
    }}
  >
    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
      {label}
    </Typography>
    <Typography variant="h5" sx={{ fontWeight: 700, my: 1 }}>
      {value}
    </Typography>
    {change && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingUp size={16} color="#2F8F5B" />
        <Typography variant="caption" sx={{ color: '#2F8F5B' }}>
          {change}
        </Typography>
      </Box>
    )}
  </Card>
);

const Dashboard = () => {
  return (
    <Layout title="Dashboard">
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TODAY'S SALES" value="₹45,320" change="+12% from yesterday" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="WEEKLY SALES" value="₹3.2L" change="+8% from last week" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="MONTHLY SALES" value="₹12.5L" change="+15% from last month" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="PROFIT" value="₹2.45L" change="+20% from last month" />
        </Grid>
      </Grid>

      <Card sx={{ padding: '24px', backgroundColor: '#FFFFFF', borderRadius: '9px' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Recent Transactions
        </Typography>
        <Typography variant="body2" sx={{ color: '#5F6478' }}>
          No transactions yet
        </Typography>
      </Card>
    </Layout>
  );
};

export default Dashboard;
