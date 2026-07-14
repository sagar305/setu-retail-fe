import React, { useState } from 'react';
import { Box, Card, TextField, Button, Table, TableBody, TableCell, TableHead, TableRow, Chip } from '@mui/material';
import Layout from '../components/Layout';
import { Plus, Edit2, Copy } from 'lucide-react';

const ProductMaster = () => {
  return (
    <Layout title="Product Master">
      <Card sx={{ padding: '24px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <TextField placeholder="Search products..." size="small" />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<Plus size={16} />}>Add Product</Button>
            <Button variant="outlined">Import CSV</Button>
            <Button variant="outlined">Export CSV</Button>
          </Box>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>PRODUCT</TableCell>
              <TableCell>TYPE</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>UNIT</TableCell>
              <TableCell>PRICE</TableCell>
              <TableCell>ACTION</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[1,2,3].map(i => (
              <TableRow key={i}>
                <TableCell>Product {i}</TableCell>
                <TableCell><Chip label="Standard" size="small" /></TableCell>
                <TableCell>SKU-{i}</TableCell>
                <TableCell>per unit</TableCell>
                <TableCell>₹100</TableCell>
                <TableCell>
                  <Button variant="text" size="small"><Edit2 size={16} /></Button>
                  <Button variant="text" size="small"><Copy size={16} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Layout>
  );
};

export default ProductMaster;
