import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import {
  Box,
  Card,
  TextField,
  Button,
  Grid,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ShoppingCart, X } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';
import { SSEContext } from '../context/SSEContext';
import { OutletContext } from '../context/OutletContext';
import useOffline from '../hooks/useOffline';

const POSBilling = () => {
  const { getRecentEvents, isConnected } = useContext(SSEContext);
  const { selectedOutlet } = useContext(OutletContext);
  const { isOnline, saveOfflineInvoice } = useOffline();
  const [products, setProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showHeldBills, setShowHeldBills] = useState(false);
  const [heldBills, setHeldBills] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [tenderPayment, setTenderPayment] = useState(0);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const barcodeRef = useRef(null);

  const fetchProductsCallback = useCallback(() => {
    try {
      setLoading(true);
      api.get('/products').then((response) => {
        let productsList = Array.isArray(response.data) ? response.data : (response.data.products || []);

        if (selectedOutlet) {
          productsList = productsList.filter(p => {
            if (!p.assignedOutlets || p.assignedOutlets.length === 0) {
              return true;
            }
            const assignedOutletIds = p.assignedOutlets.map(o => typeof o === 'string' ? o : o._id);
            return assignedOutletIds.includes(selectedOutlet._id);
          });
        }

        setProducts(productsList);

        const categorySet = new Set();
        productsList.forEach(p => {
          if (p.category) {
            const categoryName = typeof p.category === 'string' ? p.category : p.category.name;
            if (categoryName) {
              categorySet.add(categoryName);
            }
          }
        });
        setAllCategories(Array.from(categorySet).sort());
      }).finally(() => {
        setLoading(false);
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
    }
  }, [selectedOutlet]);

  const loadHeldBillsCallback = useCallback(() => {
    const stored = sessionStorage.getItem('heldBills');
    if (stored) {
      setHeldBills(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    fetchProductsCallback();
    loadHeldBillsCallback();
    if (barcodeRef.current) barcodeRef.current.focus();
  }, [fetchProductsCallback, loadHeldBillsCallback]);

  useEffect(() => {
    const invoiceEvents = getRecentEvents('invoice:created');
    setRecentInvoices(invoiceEvents);
  }, [getRecentEvents]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setShowCustomerSearch(true);
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleHoldBill();
      } else if (e.key === 'F6') {
        e.preventDefault();
        setShowHeldBills(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setShowPayment(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [cart]);

  const saveBillToHeld = () => {
    const bill = {
      id: Date.now(),
      outlet: selectedOutlet,
      customer: selectedCustomer,
      items: [...cart],
      cartDiscount,
      total: calculateTotal(),
      timestamp: new Date(),
    };
    const updated = [...heldBills, bill];
    setHeldBills(updated);
    sessionStorage.setItem('heldBills', JSON.stringify(updated));
  };

  const handleHoldBill = () => {
    if (cart.length === 0) return;
    saveBillToHeld();
    setCart([]);
    setSelectedCustomer(null);
    setCartDiscount(0);
  };

  const handleRecallBill = (bill) => {
    setCart(bill.items);
    setSelectedCustomer(bill.customer);
    setCartDiscount(bill.cartDiscount || 0);
    setHeldBills(heldBills.filter((b) => b.id !== bill.id));
    sessionStorage.setItem('heldBills', JSON.stringify(heldBills.filter((b) => b.id !== bill.id)));
    setShowHeldBills(false);
  };

  const handleBarcodeInput = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const product = products.find((p) => p.barcode === barcodeInput || p.sku === barcodeInput);
      if (product) {
        handleAddToCart(product);
      }
      setBarcodeInput('');
      if (barcodeRef.current) barcodeRef.current.focus();
    }
  };

  const handleAddToCart = (product) => {
    const existing = cart.find((item) => item._id === product._id);
    if (existing) {
      existing.quantity += 1;
    } else {
      setCart([
        ...cart,
        {
          _id: product._id,
          name: product.name,
          sku: product.sku,
          pricing: product.pricing,
          quantity: 1,
        },
      ]);
    }
  };

  const handleRemoveFromCart = (productId) => {
    setCart(cart.filter((item) => item._id !== productId));
  };

  const handleQuantityChange = (productId, quantity) => {
    const item = cart.find((item) => item._id === productId);
    if (item) {
      item.quantity = Math.max(1, quantity);
    }
    setCart([...cart]);
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.pricing.sellingPrice * item.quantity), 0);
  };

  const calculateTax = () => {
    let tax = 0;
    cart.forEach((item) => {
      const taxRate = item.pricing.tax || 0;
      tax += (item.pricing.sellingPrice * item.quantity * taxRate) / 100;
    });
    return tax;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() - cartDiscount;
  };

  const searchCustomers = async (query) => {
    if (query.length < 2) {
      setCustomers([]);
      return;
    }
    try {
      setSearchingCustomers(true);
      const response = await api.get('/customers', { params: { search: query } });
      const customersList = Array.isArray(response.data) ? response.data : (response.data.customers || []);
      setCustomers(customersList);
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setSearchingCustomers(false);
    }
  };

  const handleCompletePayment = async () => {
    if (cart.length === 0) return;

    try {
      setSavingInvoice(true);

      const grandTotal = calculateTotal();

      const invoiceData = {
        items: cart.map((item) => ({
          productId: item._id,
          quantity: item.quantity,
          discount: 0,
        })),
        customer: selectedCustomer?._id || null,
        outlet: selectedOutlet?._id || null,
        cartDiscount: cartDiscount,
        payment: {
          method: paymentMethod,
          change: paymentMethod === 'cash' ? Math.max(0, tenderPayment - grandTotal) : 0,
        },
      };

      try {
        const response = await api.post('/invoices', invoiceData);
        alert(`Invoice created: ${response.data.invoiceNumber}`);
      } catch (error) {
        if (!isOnline) {
          try {
            const offlineInvoice = await saveOfflineInvoice(invoiceData);
            alert(`Invoice saved offline (will sync when online): ${offlineInvoice._id}`);
          } catch (offlineError) {
            throw new Error('Failed to save invoice offline: ' + offlineError.message);
          }
        } else {
          throw error;
        }
      }

      setCart([]);
      setSelectedCustomer(null);
      setCartDiscount(0);
      setShowPayment(false);
      setTenderPayment(0);
      setPaymentMethod('cash');
    } catch (error) {
      alert('Error creating invoice: ' + error.message);
    } finally {
      setSavingInvoice(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const name = p.name || '';
    const sku = p.sku || '';
    const query = searchQuery || '';
    const matchesSearch = name.toLowerCase().includes(query.toLowerCase()) ||
      sku.toLowerCase().includes(query.toLowerCase());

    let matchesCategory = true;
    if (selectedCategory !== 'all') {
      const categoryName = typeof p.category === 'string' ? p.category : p.category?.name;
      matchesCategory = categoryName === selectedCategory;
    }

    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <Layout title="POS Billing">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="POS Billing">
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Real-time sync disconnected. Reconnecting...
        </Alert>
      )}

      {!isOnline && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You are working in offline mode. Invoices will sync when you reconnect.
        </Alert>
      )}

      {recentInvoices.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {recentInvoices.length > 0 && (
            <Typography variant="body2">
              <strong>Recent Invoices:</strong> {recentInvoices.slice(0, 3).map((inv, idx) => (
                <span key={idx}>
                  {inv.data.invoiceNumber} (₹{inv.data.amount}) {idx < 2 ? '• ' : ''}
                </span>
              ))}
            </Typography>
          )}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ minHeight: '85vh' }}>
        <Grid item xs={12} md={8}>
          <Card sx={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                ref={barcodeRef}
                fullWidth
                placeholder="Scan barcode (F2 search, F3 customer, F5 hold, F6 recall, F9 pay)"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={handleBarcodeInput}
                size="small"
                sx={{ mb: 1 }}
              />
            </Box>

            <TextField
              fullWidth
              placeholder="Search by name, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 1, mb: 2, overflow: 'auto', pb: 1 }}>
              <Chip
                label="ALL"
                onClick={() => setSelectedCategory('all')}
                variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
                sx={{
                  backgroundColor: selectedCategory === 'all' ? '#1B1F3B' : 'transparent',
                  color: selectedCategory === 'all' ? '#FFF' : '#1B1F3B',
                }}
              />
              {allCategories.map((cat) => (
                <Chip
                  key={cat}
                  label={String(cat).toUpperCase()}
                  onClick={() => setSelectedCategory(cat)}
                  variant={selectedCategory === cat ? 'filled' : 'outlined'}
                  sx={{
                    backgroundColor: selectedCategory === cat ? '#1B1F3B' : 'transparent',
                    color: selectedCategory === cat ? '#FFF' : '#1B1F3B',
                  }}
                />
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, flex: 1, overflowY: 'auto' }}>
              {filteredProducts.map((product) => (
                <Card
                  key={product._id}
                  sx={{
                    padding: '12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 2 },
                  }}
                  onClick={() => handleAddToCart(product)}
                >
                  <Box sx={{ backgroundColor: '#F2A03D', height: '60px', borderRadius: '6px', mb: 1 }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                    {product.name.substring(0, 15)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9AA0C0', display: 'block' }}>
                    {product.sku}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#F2A03D' }}>
                    ₹{product.pricing.sellingPrice}
                  </Typography>
                </Card>
              ))}
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Cart ({cart.length})
            </Typography>

            {selectedCustomer && (
              <Box sx={{ mb: 2, p: 1, backgroundColor: '#E5F9F0', borderRadius: '6px' }}>
                <Typography variant="caption" sx={{ color: '#2F8F5B', fontWeight: 600 }}>
                  {selectedCustomer.name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#9AA0C0', display: 'block' }}>
                  {selectedCustomer.phone}
                </Typography>
              </Box>
            )}

            {cart.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9AA0C0' }}>
                <ShoppingCart size={40} />
              </Box>
            ) : (
              <>
                <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Qty</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          Total
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item._id} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {item.name.substring(0, 12)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item._id, parseInt(e.target.value))}
                              size="small"
                              sx={{ width: 50 }}
                              inputProps={{ min: '1' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                ₹{(item.pricing.sellingPrice * item.quantity).toFixed(0)}
                              </Typography>
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => handleRemoveFromCart(item._id)}
                                sx={{ minWidth: '20px', p: 0 }}
                              >
                                <X size={14} />
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '13px' }}>
                    <Typography variant="caption">Subtotal:</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      ₹{calculateSubtotal().toFixed(0)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '13px' }}>
                    <Typography variant="caption">Tax:</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      ₹{calculateTax().toFixed(0)}
                    </Typography>
                  </Box>
                  {cartDiscount > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '13px' }}>
                      <Typography variant="caption">Discount:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#2F8F5B' }}>
                        -₹{cartDiscount.toFixed(0)}
                      </Typography>
                    </Box>
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '16px' }}>
                    <Typography>Total:</Typography>
                    <Typography sx={{ color: '#F2A03D' }}>₹{calculateTotal().toFixed(0)}</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setShowCustomerSearch(true)}
                    sx={{ flex: 1, fontSize: '12px' }}
                  >
                    Customer (F3)
                  </Button>
                  <Button size="small" variant="outlined" onClick={handleHoldBill} sx={{ flex: 1, fontSize: '12px' }}>
                    Hold (F5)
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setShowHeldBills(true)}
                    sx={{ flex: 1, fontSize: '12px' }}
                  >
                    Recall (F6)
                  </Button>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  sx={{
                    backgroundColor: '#F2A03D',
                    color: '#000',
                    fontWeight: 700,
                    mb: 1,
                  }}
                  onClick={() => setShowPayment(true)}
                >
                  Complete Sale (F9)
                </Button>
              </>
            )}

            <Button fullWidth variant="outlined" onClick={() => setCart([])}>
              Clear Cart
            </Button>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={showCustomerSearch} onClose={() => setShowCustomerSearch(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Search Customer</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            placeholder="Search by name or phone..."
            value={customerSearchQuery}
            onChange={(e) => {
              setCustomerSearchQuery(e.target.value);
              searchCustomers(e.target.value);
            }}
            size="small"
            disabled={searchingCustomers}
          />
          {searchingCustomers && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={30} />
            </Box>
          )}
          <List sx={{ mt: 2 }}>
            {customers.length === 0 && customerSearchQuery.length > 0 && !searchingCustomers && (
              <Typography variant="body2" sx={{ color: '#9AA0C0', p: 2, textAlign: 'center' }}>
                No customers found
              </Typography>
            )}
            {customers.map((customer) => (
              <ListItem key={customer._id} disablePadding>
                <ListItemButton
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setShowCustomerSearch(false);
                    setCustomerSearchQuery('');
                  }}
                >
                  <ListItemText
                    primary={customer.name || 'Walk-in Customer'}
                    secondary={`${customer.phone} • Points: ${customer.rewardPoints || 0}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>

      <Dialog open={showHeldBills} onClose={() => setShowHeldBills(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Held Bills</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <List>
            {heldBills.map((bill) => (
              <ListItem key={bill.id} disablePadding>
                <ListItemButton
                  onClick={() => handleRecallBill(bill)}
                  secondary
                  sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
                >
                  <Box>
                    <ListItemText
                      primary={bill.customer?.name || 'Walk-in'}
                      secondary={`${bill.items.length} items • ₹${bill.total.toFixed(0)}`}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#9AA0C0' }}>
                    {new Date(bill.timestamp).toLocaleTimeString()}
                  </Typography>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayment} onClose={() => setShowPayment(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Complete Payment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ backgroundColor: '#F5F3ED', p: 2, borderRadius: '6px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption">Subtotal:</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  ₹{calculateSubtotal().toFixed(0)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption">Tax:</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  ₹{calculateTax().toFixed(0)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption">Discount (₹):</Typography>
                <TextField
                  type="number"
                  value={cartDiscount}
                  onChange={(e) => setCartDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  size="small"
                  sx={{ width: 100 }}
                  inputProps={{ min: '0', step: '1' }}
                />
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '16px' }}>
                <Typography>Amount Due:</Typography>
                <Typography sx={{ color: '#F2A03D' }}>₹{calculateTotal().toFixed(0)}</Typography>
              </Box>
            </Box>

            <FormControl fullWidth size="small">
              <InputLabel>Payment Method</InputLabel>
              <Select value={paymentMethod} label="Payment Method" onChange={(e) => setPaymentMethod(e.target.value)}>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="card">Card</MenuItem>
                <MenuItem value="upi">UPI</MenuItem>
              </Select>
            </FormControl>

            {paymentMethod === 'cash' && (
              <TextField
                label="Amount Received"
                type="number"
                value={tenderPayment}
                onChange={(e) => setTenderPayment(parseFloat(e.target.value) || 0)}
                size="small"
                fullWidth
                inputProps={{ min: '0', step: '1' }}
              />
            )}

            {tenderPayment > 0 && paymentMethod === 'cash' && (
              <Box sx={{ backgroundColor: '#E5F9F0', p: 2, borderRadius: '6px' }}>
                <Typography variant="caption" sx={{ color: '#2F8F5B', fontWeight: 600 }}>
                  Change: ₹{(tenderPayment - calculateTotal()).toFixed(0)}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPayment(false)} disabled={savingInvoice}>Cancel</Button>
          <Button
            onClick={handleCompletePayment}
            variant="contained"
            disabled={savingInvoice || (paymentMethod === 'cash' && tenderPayment < calculateTotal())}
          >
            {savingInvoice ? 'Processing...' : `Pay ₹${calculateTotal().toFixed(0)}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default POSBilling;
