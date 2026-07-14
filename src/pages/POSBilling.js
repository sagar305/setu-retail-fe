import React, { useState } from 'react';
import { Box, Card, TextField, Button, Grid, Typography, Chip, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { Plus, Trash2, ShoppingCart, X } from 'lucide-react';
import Layout from '../components/Layout';

const POSBilling = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Grocery', 'Dairy', 'Produce', 'Beverages', 'Personal Care'];

  const handleAddToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const handleRemoveFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const handleQuantityChange = (productId, quantity) => {
    const item = cart.find(item => item.id === productId);
    if (item) {
      item.quantity = Math.max(1, quantity);
    }
    setCart([...cart]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <Layout title="POS Billing">
      <Grid container spacing={2} sx={{ height: '100vh' }}>
        <Grid item xs={12} md={7}>
          <Card sx={{ padding: '20px', height: '100%', overflow: 'auto' }}>
            <TextField
              fullWidth
              placeholder="Search by name, SKU or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 1, mb: 2, overflow: 'auto' }}>
              {categories.map(cat => (
                <Chip
                  key={cat}
                  label={cat}
                  onClick={() => setSelectedCategory(cat)}
                  variant={selectedCategory === cat ? 'filled' : 'outlined'}
                  sx={{
                    backgroundColor: selectedCategory === cat ? '#1B1F3B' : 'transparent',
                    color: selectedCategory === cat ? '#FFF' : '#1B1F3B',
                  }}
                />
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <Card
                  key={i}
                  sx={{
                    padding: '12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 2 },
                  }}
                  onClick={() =>
                    handleAddToCart({
                      id: i,
                      name: `Product ${i}`,
                      price: 100 + i * 10,
                    })
                  }
                >
                  <Box sx={{ backgroundColor: '#F2A03D', height: '60px', borderRadius: '6px', mb: 1 }} />
                  <Typography variant="caption">{`Product ${i}`}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    ₹{100 + i * 10}
                  </Typography>
                </Card>
              ))}
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              Cart ({cart.length} items)
            </Typography>

            {cart.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9AA0C0' }}>
                <ShoppingCart size={40} />
                <Typography>Cart is empty</Typography>
              </Box>
            ) : (
              <>
                <Table size="small" sx={{ flex: 1, mb: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={item.id}>
                        <TableCell variant="small">{item.name}</TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                            size="small"
                            sx={{ width: 50 }}
                          />
                        </TableCell>
                        <TableCell>₹{item.price * item.quantity}</TableCell>
                        <TableCell>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => handleRemoveFromCart(item.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Box sx={{ borderTop: '1px solid #ddd', pt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Subtotal:</Typography>
                    <Typography>₹{cartTotal}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '18px', mb: 2 }}>
                    <Typography>Total:</Typography>
                    <Typography sx={{ color: '#F2A03D' }}>₹{cartTotal}</Typography>
                  </Box>
                  <Button fullWidth variant="contained" sx={{ backgroundColor: '#F2A03D', color: '#000', fontWeight: 700, mb: 1 }}>
                    Complete Sale
                  </Button>
                  <Button fullWidth variant="outlined">
                    Hold Bill
                  </Button>
                </Box>
              </>
            )}
          </Card>
        </Grid>
      </Grid>
    </Layout>
  );
};

export default POSBilling;
