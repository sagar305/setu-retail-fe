import React, { useState } from 'react';
import { Box, Card, TextField, Typography, Button, Grid } from '@mui/material';
import Layout from '../components/Layout';

const WeighingCounter = () => {
  const [weight, setWeight] = useState(0);

  return (
    <Layout title="Weighing Counter">
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ padding: '24px' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Scale Display
            </Typography>
            <Box
              sx={{
                backgroundColor: '#0E1124',
                color: '#F2A03D',
                padding: '40px',
                borderRadius: '9px',
                textAlign: 'center',
                mb: 2,
              }}
            >
              <Box sx={{ fontSize: '48px', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                {weight.toFixed(3)} KG
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained">Tare</Button>
              <Button variant="contained">Simulate Weigh</Button>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ padding: '24px' }}>
            <TextField fullWidth label="Search product" size="small" sx={{ mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Price Calculation
            </Typography>
            <Box sx={{ backgroundColor: '#F5F3ED', padding: '16px', borderRadius: '6px' }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Product: Rice
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Rate: ₹62/KG
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Weight: {weight.toFixed(3)} KG
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#F2A03D' }}>
                Total: ₹{(weight * 62).toFixed(2)}
              </Typography>
              <Button
                fullWidth
                variant="contained"
                sx={{ mt: 2, backgroundColor: '#F2A03D' }}
              >
                Add to Cart
              </Button>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Layout>
  );
};

export default WeighingCounter;
