import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Chip,
} from '@mui/material';
import { Edit2 } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';

const ProductAvailability = () => {
  const [products, setProducts] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutlets, setSelectedOutlets] = useState([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadData = async () => {
      await fetchProducts();
      await fetchOutlets();
    };
    loadData();
  }, [searchQuery]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');
      const params = searchQuery ? { search: searchQuery } : {};
      const response = await api.get('/products', { params });
      const productsList = Array.isArray(response.data) ? response.data : (response.data.products || []);
      setProducts(productsList);
    } catch (err) {
      setError('Failed to load products');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOutlets = async () => {
    try {
      const response = await api.get('/outlets');
      const outletsList = Array.isArray(response.data) ? response.data : (response.data.outlets || []);
      setOutlets(outletsList);
    } catch (err) {
      console.error('Error fetching outlets:', err);
    }
  };

  const handleOpenForm = (product) => {
    setSelectedProduct(product);
    const assignedOutletIds = product.assignedOutlets ? product.assignedOutlets.map(o => typeof o === 'string' ? o : o._id) : [];
    setSelectedOutlets(assignedOutletIds);
    setOpenForm(true);
  };

  const handleOutletToggle = (outletId) => {
    setSelectedOutlets((prev) => {
      if (prev.includes(outletId)) {
        return prev.filter(id => id !== outletId);
      } else {
        return [...prev, outletId];
      }
    });
  };

  const handleSaveAvailability = async () => {
    try {
      if (!selectedProduct) return;

      setSaving(true);
      setError('');

      await api.put(`/products/${selectedProduct._id}/outlets`, {
        outlets: selectedOutlets,
      });

      setOpenForm(false);
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save product availability');
      console.error('Error saving availability:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <Layout title="Product Availability">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Product Availability">
      <Card sx={{ padding: '24px', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: '300px' }}>
            <TextField
              placeholder="Search products by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              fullWidth
              disabled={loading}
            />
          </Box>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
      </Card>

      <Card sx={{ padding: '24px' }}>
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 2 }}>
          Assign products to outlets - Click "Edit" to select which outlets should stock each product
        </Typography>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>PRODUCT NAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>CATEGORY</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ASSIGNED TO ({outlets.length} outlets)</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                ACTION
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: '#9AA0C0' }}>
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const assignedCount = product.assignedOutlets ? product.assignedOutlets.length : 0;
                return (
                  <TableRow key={product._id} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {product.name}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {product.sku}
                    </TableCell>
                    <TableCell>
                      {typeof product.category === 'string' ? product.category : product.category?.name}
                    </TableCell>
                    <TableCell>
                      {assignedCount === 0 ? (
                        <Chip label="Not assigned" size="small" variant="outlined" color="error" />
                      ) : assignedCount === outlets.length ? (
                        <Chip label="All outlets" size="small" color="success" />
                      ) : (
                        <Chip label={`${assignedCount}/${outlets.length} outlets`} size="small" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => handleOpenForm(product)}
                        sx={{ color: '#1B1F3B' }}
                      >
                        <Edit2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Outlets - {selectedProduct?.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Select which outlets should stock this product:
            </Typography>
            <FormGroup>
              {outlets.map((outlet) => (
                <FormControlLabel
                  key={outlet._id}
                  control={
                    <Checkbox
                      checked={selectedOutlets.includes(outlet._id)}
                      onChange={() => handleOutletToggle(outlet._id)}
                    />
                  }
                  label={`${outlet.name} (${outlet.city}, ${outlet.state})`}
                />
              ))}
            </FormGroup>
            {outlets.length === 0 && (
              <Alert severity="info">
                No outlets found. Please create outlets first.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveAvailability} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default ProductAvailability;
