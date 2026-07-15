import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Box,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';

const StatCard = ({ label, value, color = '#1B1F3B' }) => (
  <Card sx={{ padding: '24px', backgroundColor: '#FFFFFF', borderRadius: '9px' }}>
    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
      {label}
    </Typography>
    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color }}>
      {value}
    </Typography>
  </Card>
);

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState({});
  const [openAdjust, setOpenAdjust] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [adjustData, setAdjustData] = useState({
    quantity: 0,
    type: 'adjustment',
    reason: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchInventory();
    fetchStats();
  }, [searchQuery, filterType]);

  const fetchInventory = async () => {
    try {
      const params = { search: searchQuery };
      if (filterType === 'low-stock') params.lowStockOnly = true;
      const response = await api.get('/inventory', { params });
      setInventory(response.data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/inventory/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleOpenAdjust = (item) => {
    setSelectedItem(item);
    setAdjustData({ quantity: 0, type: 'adjustment', reason: '' });
    setOpenAdjust(true);
  };

  const handleSaveAdjustment = async () => {
    try {
      await api.post('/inventory/adjust', {
        productId: selectedItem.productId._id,
        ...adjustData,
      });
      setOpenAdjust(false);
      fetchInventory();
      fetchStats();
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  };

  const getStockStatus = (item) => {
    const product = item.productId;
    const minStock = product?.inventory?.minimumStock || 0;

    if (item.currentStock === 0) {
      return { label: 'Out of Stock', color: '#C24A3D', bgColor: '#FFE5E0' };
    }
    if (item.currentStock <= minStock) {
      return { label: 'Low Stock', color: '#F2A03D', bgColor: '#FFF4E5' };
    }
    return { label: 'In Stock', color: '#2F8F5B', bgColor: '#E5F9F0' };
  };

  const filteredInventory = filterType === 'all' ? inventory : inventory.filter(item => item.currentStock === 0);

  return (
    <Layout title="Inventory">
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL SKUS" value={stats.totalSkus || 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="LOW STOCK" value={stats.lowStockCount || 0} color="#F2A03D" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="OUT OF STOCK" value={stats.outOfStockCount || 0} color="#C24A3D" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="STOCK VALUE" value={`₹${(stats.totalStockValue || 0).toFixed(0)}`} />
        </Grid>
      </Grid>

      <Card sx={{ padding: '24px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: '250px' }}
          />
          <FormControl size="small" sx={{ minWidth: '150px' }}>
            <InputLabel>Filter</InputLabel>
            <Select value={filterType} label="Filter" onChange={(e) => setFilterType(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="low-stock">Low Stock</MenuItem>
              <MenuItem value="out-of-stock">Out of Stock</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>PRODUCT</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>CATEGORY</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                STOCK
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>MIN</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                ACTION
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inventory.map((item) => {
              const status = getStockStatus(item);
              return (
                <TableRow key={item._id} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                  <TableCell>{item.productId?.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>
                    {item.productId?.sku}
                  </TableCell>
                  <TableCell>{item.productId?.category}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: '14px' }}
                  >
                    {item.currentStock}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'JetBrains Mono' }}>
                    {item.productId?.inventory?.minimumStock || 0}
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={status.color === '#C24A3D' ? <AlertCircle size={16} /> : undefined}
                      label={status.label}
                      size="small"
                      sx={{
                        backgroundColor: status.bgColor,
                        color: status.color,
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleOpenAdjust(item)}
                      sx={{ color: '#1B1F3B' }}
                    >
                      Adjust
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={openAdjust} onClose={() => setOpenAdjust(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Adjust Stock - {selectedItem?.productId?.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
              Current Stock: <strong>{selectedItem?.currentStock}</strong>
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={adjustData.type}
                label="Type"
                onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value })}
              >
                <MenuItem value="purchase">Purchase In</MenuItem>
                <MenuItem value="sale">Sale Out</MenuItem>
                <MenuItem value="adjustment">Adjustment</MenuItem>
                <MenuItem value="damage">Damage</MenuItem>
                <MenuItem value="audit">Audit Count</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Quantity"
              type="number"
              value={adjustData.quantity}
              onChange={(e) => setAdjustData({ ...adjustData, quantity: parseInt(e.target.value) })}
              size="small"
            />
            <TextField
              label="Reason"
              value={adjustData.reason}
              onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
              multiline
              rows={3}
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdjust(false)}>Cancel</Button>
          <Button onClick={handleSaveAdjustment} variant="contained">
            Adjust
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Inventory;
