import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  Grid,
  IconButton,
  Divider,
  Alert,
  Paper,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { Layout } from '../components/Layout';
import { useAppStore } from '../store/appStore';
import { useBarcodeScan } from '../hooks/useBarcodeScan';
import { productAPI, billAPI, customerAPI } from '../services/api';
import { Product, CartItem, Customer } from '../types';

export const Billing = () => {
  const { cart, addToCart, removeFromCart, updateCartItem, clearCart, selectedCustomer, setSelectedCustomer, setLoading, loading, setError, error } =
    useAppStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState(0);

  const { videoRef, canvasRef, isScanning } = useBarcodeScan(
    (result) => {
      handleBarcodeScanned(result.data);
      setShowScanner(false);
    },
    showScanner
  );

  // Search products
  const handleProductSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.length >= 2) {
      try {
        const { data } = await productAPI.getAll(query);
        setProducts(data);
      } catch (err) {
        setError('Failed to search products');
      }
    }
  };

  // Scan barcode
  const handleBarcodeScanned = async (barcode: string) => {
    try {
      setLoading(true);
      const { data } = await productAPI.scanBarcode(barcode);

      const cartItem: CartItem = {
        productId: data._id,
        productName: data.name,
        quantity: 1,
        price: data.sellingPrice,
        tax: (data.sellingPrice * data.tax) / 100,
        discount: 0,
        total: data.sellingPrice + (data.sellingPrice * data.tax) / 100,
        barcode: data.barcode,
        product: data,
      };

      addToCart(cartItem);
      setSearchQuery('');
    } catch (err) {
      setError('Product not found');
    } finally {
      setLoading(false);
    }
  };

  // Add product from search
  const addProductToCart = (product: Product) => {
    const cartItem: CartItem = {
      productId: product._id,
      productName: product.name,
      quantity: 1,
      price: product.sellingPrice,
      tax: (product.sellingPrice * product.tax) / 100,
      discount: 0,
      total: product.sellingPrice + (product.sellingPrice * product.tax) / 100,
      barcode: product.barcode,
      product,
    };

    addToCart(cartItem);
    setSearchQuery('');
    setProducts([]);
  };

  // Search customers
  const handleCustomerSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setCustomerSearch(query);

    if (query.length >= 2) {
      try {
        const { data } = await customerAPI.search(query);
        setCustomers(data);
      } catch (err) {
        setError('Failed to search customers');
      }
    }
  };

  // Create customer
  const handleCreateCustomer = async () => {
    if (!customerSearch.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    try {
      const { data } = await customerAPI.create({
        name: customerSearch.split('@')[0],
        phone: customerSearch,
        email: customerSearch,
      });
      setSelectedCustomer(data);
      setShowCustomerDialog(false);
      setCustomerSearch('');
    } catch (err) {
      setError('Failed to create customer');
    }
  };

  // Process payment
  const handleCompleteTransaction = async () => {
    if (cart.length === 0) {
      setError('Cart is empty');
      return;
    }

    const billTotal = cart.reduce((sum, item) => sum + item.total, 0) - discount;
    if (paymentAmount < billTotal) {
      setError('Insufficient payment');
      return;
    }

    try {
      setLoading(true);
      const billNumber = `BILL-${Date.now()}`;

      const billData = {
        billNumber,
        customerId: selectedCustomer?._id,
        outlet: 'default',
        items: cart,
        subtotal: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
        taxAmount: cart.reduce((sum, item) => sum + item.tax * item.quantity, 0),
        discountAmount: discount,
        total: cart.reduce((sum, item) => sum + item.total, 0) - discount,
        paymentMethod,
        paymentDetails: { amount: paymentAmount, change: paymentAmount - billTotal },
      };

      await billAPI.create(billData);

      // Print invoice (mock)
      console.log('Invoice:', billData);
      alert(`Bill #${billNumber} created successfully!\nTotal: ₹${(billTotal).toFixed(2)}\nChange: ₹${(paymentAmount - billTotal).toFixed(2)}`);

      // Reset
      clearCart();
      setSelectedCustomer(null);
      setDiscount(0);
      setPaymentMethod('cash');
      setPaymentAmount(0);
      setCustomerSearch('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create bill');
    } finally {
      setLoading(false);
    }
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartTax = cart.reduce((sum, item) => sum + item.tax * item.quantity, 0);
  const cartTotal = cartSubtotal + cartTax - discount;

  return (
    <Layout title="Billing">
      <Grid container spacing={2} sx={{ height: '100%', gap: 0 }}>
        {/* Left: Product Search & Cart */}
        <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          {/* Search Bar */}
          <Card sx={{ p: 2, display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              placeholder="Search product by name, SKU, or barcode (F2)"
              value={searchQuery}
              onChange={handleProductSearch}
              variant="outlined"
              size="small"
              sx={{ flex: 1 }}
            />
            <Button
              variant="outlined"
              startIcon={<CameraAltIcon />}
              onClick={() => setShowScanner(!showScanner)}
              sx={{ minWidth: 'auto', bgcolor: showScanner ? 'var(--color-secondary)' : 'transparent' }}
            >
              Scan
            </Button>
          </Card>

          {/* Camera Scanner */}
          {showScanner && (
            <Card sx={{ p: 2, position: 'relative', bgcolor: '#000', height: 300 }}>
              <video
                ref={videoRef}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <Button
                variant="contained"
                onClick={() => setShowScanner(false)}
                sx={{ position: 'absolute', bottom: 10, right: 10 }}
              >
                Close Scanner
              </Button>
            </Card>
          )}

          {/* Search Results */}
          {products.length > 0 && (
            <Card sx={{ p: 0, maxHeight: 300, overflow: 'auto' }}>
              {products.map((product) => (
                <Box
                  key={product._id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 1.5,
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'var(--color-background)' },
                  }}
                  onClick={() => addProductToCart(product)}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {product.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                      SKU: {product.sku}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    ₹{product.sellingPrice}
                  </Typography>
                </Box>
              ))}
            </Card>
          )}

          {/* Cart Items */}
          <Card sx={{ p: 0, flex: 1, overflow: 'auto' }}>
            {cart.length > 0 ? (
              <Table size="small" sx={{ minWidth: '100%' }}>
                <TableHead sx={{ bgcolor: 'var(--color-light)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Total</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.productId} sx={{ '&:hover': { bgcolor: 'var(--color-background)' } }}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.productName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                            Tax: ₹{(item.tax * item.quantity).toFixed(2)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => updateCartItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}>
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <Typography sx={{ minWidth: 20, textAlign: 'center' }}>{item.quantity}</Typography>
                          <IconButton size="small" onClick={() => updateCartItem(item.productId, { quantity: item.quantity + 1 })}>
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell align="right">₹{item.price.toFixed(2)}</TableCell>
                      <TableCell align="right">₹{(item.total * item.quantity).toFixed(2)}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => removeFromCart(item.productId)}>
                          <DeleteIcon fontSize="small" sx={{ color: 'var(--color-error)' }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Typography>Cart is empty</Typography>
              </Box>
            )}
          </Card>
        </Grid>

        {/* Right: Cart Summary & Payment */}
        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Customer Selection */}
          <Card sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Customer
            </Typography>
            {selectedCustomer ? (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {selectedCustomer.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                  {selectedCustomer.phone}
                </Typography>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerSearch('');
                  }}
                  sx={{ display: 'block', mt: 1 }}
                >
                  Clear
                </Button>
              </Box>
            ) : (
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setShowCustomerDialog(true)}
                sx={{ textTransform: 'none' }}
              >
                Search Customer
              </Button>
            )}
          </Card>

          {/* Bill Summary */}
          <Card sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Bill Summary
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Subtotal</Typography>
              <Typography variant="body2">₹{cartSubtotal.toFixed(2)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2">Tax</Typography>
              <Typography variant="body2">₹{cartTax.toFixed(2)}</Typography>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 1 }}>
              <TextField
                label="Discount"
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                size="small"
                variant="outlined"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Total"
                type="number"
                value={cartTotal.toFixed(2)}
                disabled
                size="small"
                variant="outlined"
                sx={{ flex: 1 }}
              />
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'right', mb: 2 }}>
              ₹{cartTotal.toFixed(2)}
            </Typography>
          </Card>

          {/* Payment Method & Amount */}
          <Card sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Payment
            </Typography>
            <TextField
              fullWidth
              label="Method"
              select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              variant="outlined"
              size="small"
              sx={{ mb: 1 }}
              SelectProps={{
                native: true,
              }}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="wallet">Wallet</option>
            </TextField>

            <TextField
              fullWidth
              label="Amount Received"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              variant="outlined"
              size="small"
              sx={{ mb: 2 }}
            />

            {paymentAmount > 0 && (
              <Box sx={{ mb: 2, p: 1, bgcolor: 'var(--color-background)', borderRadius: 'var(--radius-md)' }}>
                <Typography variant="caption">Change: ₹{(paymentAmount - cartTotal).toFixed(2)}</Typography>
              </Box>
            )}

            <Button
              fullWidth
              variant="contained"
              onClick={handleCompleteTransaction}
              disabled={loading || cart.length === 0}
              sx={{
                bgcolor: 'var(--color-primary)',
                color: 'white',
                fontWeight: 600,
                py: 1.5,
                '&:hover': { bgcolor: 'var(--color-tertiary)' },
              }}
            >
              {loading ? 'Processing...' : 'Complete Sale (F9)'}
            </Button>

            <Button
              fullWidth
              variant="outlined"
              onClick={clearCart}
              sx={{ mt: 1 }}
              disabled={cart.length === 0}
            >
              Clear Cart
            </Button>
          </Card>
        </Grid>
      </Grid>

      {/* Customer Search Dialog */}
      <Dialog open={showCustomerDialog} onClose={() => setShowCustomerDialog(false)} maxWidth="sm" fullWidth>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Search or Create Customer
          </Typography>
          <TextField
            fullWidth
            placeholder="Enter name or phone"
            value={customerSearch}
            onChange={handleCustomerSearch}
            variant="outlined"
            size="small"
            sx={{ mb: 2 }}
          />

          {customers.length > 0 && (
            <Box sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
              {customers.map((customer) => (
                <Box
                  key={customer._id}
                  sx={{
                    p: 1.5,
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'var(--color-background)' },
                  }}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setShowCustomerDialog(false);
                    setCustomerSearch('');
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {customer.name}
                  </Typography>
                  <Typography variant="caption">{customer.phone}</Typography>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleCreateCustomer}
              sx={{ bgcolor: 'var(--color-secondary)' }}
            >
              Create New
            </Button>
            <Button fullWidth variant="outlined" onClick={() => setShowCustomerDialog(false)}>
              Cancel
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Layout>
  );
};
