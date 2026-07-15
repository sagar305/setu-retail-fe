import React, { useState, useEffect, useContext } from 'react';
import {
  Box,
  Card,
  TextField,
  Typography,
  Button,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import Layout from '../components/Layout';
import { OutletContext } from '../context/OutletContext';
import api from '../services/api';

const WeighingCounter = () => {
  const { selectedOutlet } = useContext(OutletContext);
  const [weight, setWeight] = useState(0);
  const [scales, setScales] = useState([]);
  const [selectedScale, setSelectedScale] = useState('');
  const [scaleStatus, setScaleStatus] = useState('disconnected');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [barcodeImage, setBarcodeImage] = useState(null);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchScales();
    fetchProducts();
  }, [selectedOutlet]);

  const fetchScales = async () => {
    try {
      const params = selectedOutlet ? { outletId: selectedOutlet._id } : {};
      const response = await api.get('/scales', { params });
      setScales(response.data.scales);
      if (response.data.scales.length > 0) {
        setSelectedScale(response.data.scales[0]._id);
      }
    } catch (err) {
      setError('Failed to fetch scales');
    }
  };

  const fetchProducts = async () => {
    try {
      const params = { limit: 1000, skip: 0 };
      if (selectedOutlet) params.outletId = selectedOutlet._id;
      const response = await api.get('/products', { params });
      const productsList = Array.isArray(response.data) ? response.data : (response.data.products || []);
      setProducts(productsList.filter((p) => p.productType === 'weight_based'));
    } catch (err) {
      setError('Failed to fetch products');
    }
  };

  const connectScale = async () => {
    if (!selectedScale) {
      setError('Please select a scale');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/scales/${selectedScale}/connect`);
      setScaleStatus('connected');
      setSuccess('Scale connected successfully');
      startWeightPolling();
    } catch (err) {
      setError('Failed to connect scale');
      setScaleStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const disconnectScale = async () => {
    try {
      await api.post(`/scales/${selectedScale}/disconnect`);
      setScaleStatus('disconnected');
      setWeight(0);
      setSuccess('Scale disconnected');
    } catch (err) {
      setError('Failed to disconnect scale');
    }
  };

  const startWeightPolling = () => {
    const interval = setInterval(() => {
      if (scaleStatus === 'connected' && selectedScale) {
        api
          .get(`/scales/${selectedScale}/weight`)
          .then((response) => {
            setWeight(response.data.weight);
          })
          .catch((err) => {
            console.error('Weight polling error:', err);
          });
      }
    }, 500);

    return () => clearInterval(interval);
  };

  const handleTare = async () => {
    try {
      await api.post(`/scales/${selectedScale}/tare`);
      setSuccess('Scale tared');
      setWeight(0);
    } catch (err) {
      setError('Failed to tare scale');
    }
  };

  const searchProducts = () => {
    if (searchQuery.trim()) {
      const filtered = products.filter((p) => {
        const name = p.name || '';
        const sku = p.sku || '';
        const query = searchQuery || '';
        return (
          name.toLowerCase().includes(query.toLowerCase()) ||
          sku.toLowerCase().includes(query.toLowerCase())
        );
      });
      if (filtered.length > 0) {
        setSelectedProduct(filtered[0]);
      } else {
        setError('Product not found');
      }
    }
  };

  const generateBarcode = async () => {
    if (!selectedProduct || !selectedScale) {
      setError('Please select a product and scale');
      return;
    }

    setGeneratingBarcode(true);
    try {
      const response = await api.post(`/scales/${selectedScale}/print-barcode`, {
        sku: selectedProduct.sku,
        productName: selectedProduct.name,
        pricePerKg: selectedProduct.weightBased.pricePerKg,
      });

      if (response.data.image) {
        setBarcodeImage(`data:image/png;base64,${response.data.image}`);
        setSuccess('Barcode generated successfully');
      }
    } catch (err) {
      setError('Failed to generate barcode');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const printBarcode = () => {
    if (!barcodeImage) return;

    const printWindow = window.open('', '', 'width=400,height=300');
    printWindow.document.write(`<img src="${barcodeImage}" style="width:100%;"/>`);
    printWindow.document.close();
    printWindow.print();
  };

  const addToCart = () => {
    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }

    const cartItem = {
      productId: selectedProduct._id,
      name: selectedProduct.name,
      sku: selectedProduct.sku,
      weight,
      pricePerKg: selectedProduct.weightBased.pricePerKg,
      totalPrice: weight * selectedProduct.weightBased.pricePerKg,
    };

    localStorage.setItem('lastWeighedItem', JSON.stringify(cartItem));
    setSuccess('Item added to cart');
    setWeight(0);
    setSelectedProduct(null);
    setBarcodeImage(null);
  };

  return (
    <Layout title="Weighing Counter">
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ padding: '24px' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Scale Configuration
            </Typography>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Select Scale</InputLabel>
              <Select
                value={selectedScale}
                onChange={(e) => setSelectedScale(e.target.value)}
                label="Select Scale"
              >
                {scales.map((scale) => (
                  <MenuItem key={scale._id} value={scale._id}>
                    {scale.name} ({scale.brand})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                variant="contained"
                onClick={connectScale}
                disabled={!selectedScale || scaleStatus === 'connected' || loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Connect'}
              </Button>
              <Button
                variant="outlined"
                onClick={disconnectScale}
                disabled={scaleStatus !== 'connected'}
              >
                Disconnect
              </Button>
            </Box>

            <Box sx={{ mb: 2, p: 1, backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              <Typography variant="body2">
                Status:{' '}
                <strong
                  style={{
                    color: scaleStatus === 'connected' ? 'green' : 'red',
                  }}
                >
                  {scaleStatus}
                </strong>
              </Typography>
            </Box>

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
            <Button fullWidth variant="contained" onClick={handleTare} disabled={!selectedScale}>
              Tare
            </Button>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ padding: '24px' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Product Selection
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="Search product (name/SKU)"
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
              />
              <Button variant="outlined" onClick={searchProducts}>
                Search
              </Button>
            </Box>

            {selectedProduct && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Price Calculation
                </Typography>
                <Box sx={{ backgroundColor: '#F5F3ED', padding: '16px', borderRadius: '6px', mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Product: <strong>{selectedProduct.name}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    SKU: <strong>{selectedProduct.sku}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Rate: <strong>₹{selectedProduct.weightBased.pricePerKg}/KG</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Weight: <strong>{weight.toFixed(3)} KG</strong>
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#F2A03D', mb: 2 }}>
                    Total: ₹{(weight * selectedProduct.weightBased.pricePerKg).toFixed(2)}
                  </Typography>

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={generateBarcode}
                    disabled={generatingBarcode || weight === 0}
                    sx={{ mb: 1 }}
                  >
                    {generatingBarcode ? <CircularProgress size={24} /> : 'Generate Barcode'}
                  </Button>

                  {barcodeImage && (
                    <>
                      <Box sx={{ mb: 2, p: 1, border: '1px solid #ddd', borderRadius: '4px' }}>
                        <img src={barcodeImage} alt="barcode" style={{ width: '100%' }} />
                      </Box>
                      <Button fullWidth variant="outlined" onClick={printBarcode} sx={{ mb: 1 }}>
                        Print Label
                      </Button>
                    </>
                  )}

                  <Button
                    fullWidth
                    variant="contained"
                    sx={{ backgroundColor: '#F2A03D' }}
                    onClick={addToCart}
                    disabled={weight === 0}
                  >
                    Add to Cart
                  </Button>
                </Box>
              </>
            )}

            {!selectedProduct && (
              <Alert severity="info">Search for a weight-based product to get started</Alert>
            )}
          </Card>
        </Grid>
      </Grid>
    </Layout>
  );
};

export default WeighingCounter;
