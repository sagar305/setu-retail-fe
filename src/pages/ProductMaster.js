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
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';
import { Plus, Edit2, Copy, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';

const ProductMaster = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [openForm, setOpenForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');

  const steps = ['Basic Info', 'Pricing', 'Inventory', 'Supplier', 'Barcode'];

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    productType: 'standard',
    category: '',
    subCategory: '',
    brand: '',
    sku: '',
    barcode: '',
    unit: 'piece',
    image: '',
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
      reorderLevel: 0,
      warehouse: '',
      shelf: '',
    },
    supplier: {
      name: '',
      moq: 0,
      leadTime: 0,
    },
    weightBased: {
      pricePerKg: 0,
      decimalPrecision: 2,
    },
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [searchQuery, selectedType]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {
        search: searchQuery,
        type: selectedType,
        limit: 50,
      };
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

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      const categoriesList = Array.isArray(response.data) ? response.data : (response.data.categories || []);
      setCategories(categoriesList);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleOpenForm = (product = null) => {
    setError('');
    setActiveStep(0);
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        productType: 'standard',
        category: '',
        subCategory: '',
        brand: '',
        sku: '',
        barcode: '',
        unit: 'piece',
        image: '',
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
          reorderLevel: 0,
          warehouse: '',
          shelf: '',
        },
        supplier: {
          name: '',
          moq: 0,
          leadTime: 0,
        },
        weightBased: {
          pricePerKg: 0,
          decimalPrecision: 2,
        },
      });
    }
    setOpenForm(true);
  };

  const handleNextStep = () => {
    if (activeStep === 0) {
      if (!formData.name || !formData.category) {
        setError('Please fill in product name and category');
        return;
      }
    } else if (activeStep === 1) {
      if (!formData.pricing.sellingPrice || !formData.pricing.purchasePrice) {
        setError('Please fill in selling and purchase prices');
        return;
      }
    }
    setError('');
    setActiveStep(activeStep + 1);
  };

  const handlePreviousStep = () => {
    setError('');
    setActiveStep(activeStep - 1);
  };

  const handleSaveProduct = async () => {
    try {
      setSaving(true);
      setError('');

      if (editingProduct) {
        await api.put(`/products/${editingProduct._id}`, formData);
      } else {
        await api.post('/products', formData);
      }

      setOpenForm(false);
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save product');
      console.error('Error saving product:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await api.delete(`/products/${productId}`);
        await fetchProducts();
      } catch (err) {
        setError('Failed to delete product');
        console.error('Error deleting product:', err);
      }
    }
  };

  const handleDuplicateProduct = async (productId) => {
    try {
      await api.post(`/products/${productId}/duplicate`);
      await fetchProducts();
    } catch (err) {
      setError('Failed to duplicate product');
      console.error('Error duplicating product:', err);
    }
  };

  const generateBarcode = () => {
    const barcode = 'BAR' + Date.now();
    setFormData({ ...formData, barcode });
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Product Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                size="small"
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type *</InputLabel>
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
              <FormControl fullWidth size="small">
                <InputLabel>Category *</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat._id} value={cat._id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Unit</InputLabel>
                <Select
                  value={formData.unit}
                  label="Unit"
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                >
                  <MenuItem value="piece">Piece</MenuItem>
                  <MenuItem value="box">Box</MenuItem>
                  <MenuItem value="packet">Packet</MenuItem>
                  <MenuItem value="bottle">Bottle</MenuItem>
                  <MenuItem value="kg">Kilogram</MenuItem>
                  <MenuItem value="gram">Gram</MenuItem>
                  <MenuItem value="liter">Liter</MenuItem>
                  <MenuItem value="ml">Milliliter</MenuItem>
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
                helperText={editingProduct ? 'Cannot change SKU for existing product' : ''}
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="MRP *"
                type="number"
                value={formData.pricing.mrp}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricing: { ...formData.pricing, mrp: parseFloat(e.target.value) || 0 },
                  })
                }
                size="small"
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Selling Price *"
                type="number"
                value={formData.pricing.sellingPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricing: { ...formData.pricing, sellingPrice: parseFloat(e.target.value) || 0 },
                  })
                }
                size="small"
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Purchase Price *"
                type="number"
                value={formData.pricing.purchasePrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricing: { ...formData.pricing, purchasePrice: parseFloat(e.target.value) || 0 },
                  })
                }
                size="small"
                inputProps={{ step: '0.01', min: '0' }}
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
                    pricing: { ...formData.pricing, tax: parseFloat(e.target.value) || 0 },
                  })
                }
                size="small"
                inputProps={{ step: '0.01', min: '0', max: '100' }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="HSN Code"
                value={formData.pricing.hsnCode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricing: { ...formData.pricing, hsnCode: e.target.value },
                  })
                }
                size="small"
              />
            </Grid>
            {formData.pricing.sellingPrice > 0 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  Margin: ₹{(formData.pricing.sellingPrice - formData.pricing.purchasePrice).toFixed(2)} (
                  {(((formData.pricing.sellingPrice - formData.pricing.purchasePrice) / formData.pricing.purchasePrice) * 100).toFixed(1)}
                  %)
                </Alert>
              </Grid>
            )}
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Opening Stock"
                type="number"
                value={formData.inventory.openingStock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inventory: { ...formData.inventory, openingStock: parseInt(e.target.value) || 0 },
                  })
                }
                size="small"
                inputProps={{ min: '0' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Minimum Stock"
                type="number"
                value={formData.inventory.minimumStock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inventory: { ...formData.inventory, minimumStock: parseInt(e.target.value) || 0 },
                  })
                }
                size="small"
                inputProps={{ min: '0' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Maximum Stock"
                type="number"
                value={formData.inventory.maximumStock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inventory: { ...formData.inventory, maximumStock: parseInt(e.target.value) || 0 },
                  })
                }
                size="small"
                inputProps={{ min: '0' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Reorder Level"
                type="number"
                value={formData.inventory.reorderLevel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inventory: { ...formData.inventory, reorderLevel: parseInt(e.target.value) || 0 },
                  })
                }
                size="small"
                inputProps={{ min: '0' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Warehouse"
                value={formData.inventory.warehouse}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inventory: { ...formData.inventory, warehouse: e.target.value },
                  })
                }
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Shelf"
                value={formData.inventory.shelf}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inventory: { ...formData.inventory, shelf: e.target.value },
                  })
                }
                size="small"
              />
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Supplier Name"
                value={formData.supplier.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    supplier: { ...formData.supplier, name: e.target.value },
                  })
                }
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Minimum Order Quantity (MOQ)"
                type="number"
                value={formData.supplier.moq}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    supplier: { ...formData.supplier, moq: parseInt(e.target.value) || 0 },
                  })
                }
                size="small"
                inputProps={{ min: '0' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Lead Time (days)"
                type="number"
                value={formData.supplier.leadTime}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    supplier: { ...formData.supplier, leadTime: parseInt(e.target.value) || 0 },
                  })
                }
                size="small"
                inputProps={{ min: '0' }}
              />
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                Note: You can manage product-supplier relationships through Purchase Orders
              </Alert>
            </Grid>
          </Grid>
        );

      case 4:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                size="small"
                disabled
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                onClick={generateBarcode}
                fullWidth
              >
                Generate Barcode
              </Button>
            </Grid>
            {formData.barcode && (
              <Grid item xs={12}>
                <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#F5F3ED' }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#9AA0C0' }}>
                    Barcode Preview
                  </Typography>
                  <Box sx={{
                    fontFamily: 'monospace',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    letterSpacing: '4px',
                    p: 2,
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                  }}>
                    {formData.barcode}
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#9AA0C0' }}>
                    {formData.barcode}
                  </Typography>
                </Card>
              </Grid>
            )}
          </Grid>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Layout title="Product Master">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

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
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => handleOpenForm()}
          >
            Add Product
          </Button>
        </Box>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ padding: '24px' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>PRODUCT NAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>TYPE</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>UNIT</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                SELLING PRICE
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                ACTIONS
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: '#9AA0C0' }}>
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product._id} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                  <TableCell sx={{ fontWeight: 600 }}>{product.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={product.productType.replace('_', ' ').toUpperCase()}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {product.sku}
                  </TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: '#F2A03D' }}>
                    ₹{product.pricing.sellingPrice.toFixed(2)}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleOpenForm(product)}
                      sx={{ color: '#1B1F3B' }}
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleDuplicateProduct(product._id)}
                      sx={{ color: '#1B1F3B' }}
                      title="Duplicate"
                    >
                      <Copy size={16} />
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleDeleteProduct(product._id)}
                      sx={{ color: '#C24A3D' }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {renderStepContent()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancel</Button>
          <Button
            onClick={handlePreviousStep}
            disabled={activeStep === 0 || saving}
          >
            Back
          </Button>
          {activeStep < steps.length - 1 ? (
            <Button
              onClick={handleNextStep}
              variant="contained"
              disabled={saving}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSaveProduct}
              variant="contained"
              disabled={saving}
            >
              {saving ? 'Saving...' : (editingProduct ? 'Update' : 'Create')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default ProductMaster;
