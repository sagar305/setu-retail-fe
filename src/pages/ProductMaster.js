import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Plus, Edit2, Copy, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';

const ProductMaster = () => {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [openForm, setOpenForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    productType: 'standard',
    category: '',
    brand: '',
    sku: '',
    barcode: '',
    unit: 'piece',
    pricing: {
      mrp: 0,
      sellingPrice: 0,
      purchasePrice: 0,
      tax: 0,
      hsnCode: '',
    },
    inventory: {
      openingStock: 0,
      minimumStock: 0,
      maximumStock: 0,
    },
  });

  useEffect(() => {
    fetchProducts();
  }, [searchQuery, selectedType]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {
        search: searchQuery,
        type: selectedType,
      };
      const response = await api.get('/products', { params });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        productType: 'standard',
        category: '',
        brand: '',
        sku: '',
        barcode: '',
        unit: 'piece',
        pricing: {
          mrp: 0,
          sellingPrice: 0,
          purchasePrice: 0,
          tax: 0,
          hsnCode: '',
        },
        inventory: {
          openingStock: 0,
          minimumStock: 0,
          maximumStock: 0,
        },
      });
    }
    setOpenForm(true);
  };

  const handleSaveProduct = async () => {
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct._id}`, formData);
      } else {
        await api.post('/products', formData);
      }
      setOpenForm(false);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await api.delete(`/products/${productId}`);
        fetchProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const handleDuplicateProduct = async (productId) => {
    try {
      await api.post(`/products/${productId}/duplicate`);
      fetchProducts();
    } catch (error) {
      console.error('Error duplicating product:', error);
    }
  };

  return (
    <Layout title="Product Master">
      <Card sx={{ padding: '24px', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: '300px' }}>
            <TextField
              placeholder="Search by name, SKU, barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              fullWidth
            />
            <FormControl size="small" sx={{ minWidth: '150px' }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={selectedType}
                label="Type"
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="weight_based">Weight Based</MenuItem>
                <MenuItem value="variable_price">Variable Price</MenuItem>
                <MenuItem value="service">Service</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => handleOpenForm()}>
              Add Product
            </Button>
            <Button variant="outlined">Import CSV</Button>
            <Button variant="outlined">Export CSV</Button>
          </Box>
        </Box>
      </Card>

      <Card sx={{ padding: '24px' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>PRODUCT NAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>TYPE</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>UNIT</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                PRICE
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                ACTIONS
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product._id} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                <TableCell>{product.name}</TableCell>
                <TableCell>
                  <Chip
                    label={product.productType.replace('_', ' ').toUpperCase()}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell sx={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>
                  {product.sku}
                </TableCell>
                <TableCell>{product.unit}</TableCell>
                <TableCell align="right" sx={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                  ₹{product.pricing.sellingPrice}
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
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => handleDuplicateProduct(product._id)}
                    sx={{ color: '#1B1F3B' }}
                  >
                    <Copy size={16} />
                  </Button>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => handleDeleteProduct(product._id)}
                    sx={{ color: '#C24A3D' }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Product Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.productType}
                  label="Type"
                  onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                >
                  <MenuItem value="standard">Standard</MenuItem>
                  <MenuItem value="weight_based">Weight Based</MenuItem>
                  <MenuItem value="variable_price">Variable Price</MenuItem>
                  <MenuItem value="service">Service</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="SKU"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                size="small"
                disabled={editingProduct}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="MRP"
                type="number"
                value={formData.pricing.mrp}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricing: { ...formData.pricing, mrp: parseFloat(e.target.value) },
                  })
                }
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Selling Price"
                type="number"
                value={formData.pricing.sellingPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricing: { ...formData.pricing, sellingPrice: parseFloat(e.target.value) },
                  })
                }
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Purchase Price"
                type="number"
                value={formData.pricing.purchasePrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricing: { ...formData.pricing, purchasePrice: parseFloat(e.target.value) },
                  })
                }
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Tax %"
                type="number"
                value={formData.pricing.tax}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricing: { ...formData.pricing, tax: parseFloat(e.target.value) },
                  })
                }
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Opening Stock"
                type="number"
                value={formData.inventory.openingStock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inventory: { ...formData.inventory, openingStock: parseInt(e.target.value) },
                  })
                }
                size="small"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancel</Button>
          <Button onClick={handleSaveProduct} variant="contained">
            {editingProduct ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default ProductMaster;
