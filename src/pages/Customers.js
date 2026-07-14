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
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Drawer,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
} from '@mui/material';
import { Plus, Phone, Mail, Gift, Award, Trash2 } from 'lucide-react';
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

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({});
  const [openForm, setOpenForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [membershipFilter, setMembershipFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birthday: '',
  });

  const [rewardData, setRewardData] = useState({
    points: 0,
    reason: '',
  });

  const [creditData, setCreditData] = useState({
    amount: 0,
    reason: '',
  });

  useEffect(() => {
    fetchCustomers();
    fetchStats();
  }, [searchQuery, membershipFilter, page, rowsPerPage]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = {
        search: searchQuery,
        skip: page * rowsPerPage,
        limit: rowsPerPage,
      };
      if (membershipFilter !== 'all') {
        params.membership = membershipFilter;
      }
      const response = await api.get('/customers', { params });
      setCustomers(response.data.customers || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/customers/stats/all');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPurchaseHistory = async (customerId) => {
    try {
      const response = await api.get(`/customers/${customerId}/history`);
      setPurchaseHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching purchase history:', error);
    }
  };

  const handleOpenForm = (customer = null) => {
    if (customer) {
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        birthday: customer.birthday ? customer.birthday.split('T')[0] : '',
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        birthday: '',
      });
    }
    setSelectedCustomer(customer);
    setOpenForm(true);
  };

  const handleSaveCustomer = async () => {
    try {
      if (selectedCustomer) {
        await api.put(`/customers/${selectedCustomer._id}`, formData);
      } else {
        await api.post('/customers', formData);
      }
      setOpenForm(false);
      fetchCustomers();
      fetchStats();
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleAddRewardPoints = async () => {
    if (!selectedCustomer || rewardData.points === 0) return;
    try {
      await api.post(`/customers/${selectedCustomer._id}/reward-points`, rewardData);
      setRewardData({ points: 0, reason: '' });
      fetchCustomers();
      handleViewDetail(selectedCustomer._id);
    } catch (error) {
      console.error('Error adding reward points:', error);
    }
  };

  const handleAddStoreCredit = async () => {
    if (!selectedCustomer || creditData.amount === 0) return;
    try {
      await api.post(`/customers/${selectedCustomer._id}/store-credit`, creditData);
      setCreditData({ amount: 0, reason: '' });
      fetchCustomers();
      handleViewDetail(selectedCustomer._id);
    } catch (error) {
      console.error('Error adding store credit:', error);
    }
  };

  const handleViewDetail = async (customerId) => {
    try {
      const response = await api.get(`/customers/${customerId}`);
      setSelectedCustomer(response.data);
      fetchPurchaseHistory(customerId);
      setShowDetail(true);
    } catch (error) {
      console.error('Error fetching customer detail:', error);
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await api.delete(`/customers/${customerId}`);
        fetchCustomers();
        setShowDetail(false);
      } catch (error) {
        console.error('Error deleting customer:', error);
      }
    }
  };

  return (
    <Layout title="Customers">
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL CUSTOMERS" value={stats.totalCustomers || 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL REWARDS" value={stats.totalRewardPoints || 0} color="#F2A03D" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="STORE CREDIT" value={`₹${(stats.totalStoreCredit || 0).toFixed(0)}`} color="#2F8F5B" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="AVG PURCHASE" value={`₹${(stats.averagePurchaseValue || 0).toFixed(0)}`} />
        </Grid>
      </Grid>

      <Card sx={{ padding: '24px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: '300px' }}>
            <TextField
              placeholder="Search by name, phone, email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              size="small"
              fullWidth
            />
            <FormControl size="small" sx={{ minWidth: '150px' }}>
              <InputLabel>Membership</InputLabel>
              <Select
                value={membershipFilter}
                label="Membership"
                onChange={(e) => {
                  setMembershipFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="regular">Regular</MenuItem>
                <MenuItem value="vip">VIP</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => handleOpenForm()}>
            Add Customer
          </Button>
        </Box>

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>NAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>PHONE</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>EMAIL</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                REWARDS
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                CREDIT
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>TIER</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                ACTION
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer._id} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                <TableCell>{customer.name}</TableCell>
                <TableCell sx={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>
                  {customer.phone}
                </TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell align="right" sx={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                  {customer.rewardPoints}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                  ₹{customer.creditBalance?.toFixed(0) || 0}
                </TableCell>
                <TableCell>
                  <Chip
                    label={(customer.membership?.tier || 'new').toUpperCase()}
                    size="small"
                    variant="outlined"
                    sx={{
                      color: customer.membership?.tier === 'vip' ? '#F2A03D' : '#1B1F3B',
                      borderColor: customer.membership?.tier === 'vip' ? '#F2A03D' : '#1B1F3B',
                    }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => handleViewDetail(customer._id)}
                    sx={{ color: '#1B1F3B' }}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Card>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              size="small"
              disabled={!!selectedCustomer}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="Birthday"
              type="date"
              value={formData.birthday}
              onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancel</Button>
          <Button onClick={handleSaveCustomer} variant="contained">
            {selectedCustomer ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={showDetail} onClose={() => setShowDetail(false)} sx={{ width: 450 }}>
        {selectedCustomer && (
          <Box sx={{ width: 450, p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">{selectedCustomer.name}</Typography>
              <Button
                variant="text"
                size="small"
                onClick={() => handleDeleteCustomer(selectedCustomer._id)}
                sx={{ color: '#C24A3D' }}
              >
                <Trash2 size={16} />
              </Button>
            </Box>

            <Box sx={{ mb: 3, flex: 1, overflowY: 'auto' }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                  CONTACT
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Phone size={16} style={{ color: '#9AA0C0' }} />
                    <Typography variant="body2">{selectedCustomer.phone}</Typography>
                  </Box>
                  {selectedCustomer.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Mail size={16} style={{ color: '#9AA0C0' }} />
                      <Typography variant="body2">{selectedCustomer.email}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                  MEMBERSHIP
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <Chip
                    label={(selectedCustomer.membership?.tier || 'new').toUpperCase()}
                    sx={{
                      backgroundColor:
                        selectedCustomer.membership?.tier === 'vip'
                          ? '#FFF4E5'
                          : selectedCustomer.membership?.tier === 'regular'
                          ? '#E5F9F0'
                          : '#F5F3ED',
                      color:
                        selectedCustomer.membership?.tier === 'vip'
                          ? '#F2A03D'
                          : selectedCustomer.membership?.tier === 'regular'
                          ? '#2F8F5B'
                          : '#5F6478',
                      fontWeight: 600,
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      REWARD POINTS
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#F2A03D' }}>
                      {selectedCustomer.rewardPoints || 0}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      STORE CREDIT
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#2F8F5B' }}>
                      ₹{(selectedCustomer.creditBalance || 0).toFixed(0)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Gift size={14} />}
                    onClick={() => {
                      setRewardData({ points: 0, reason: '' });
                      // Would open a dialog in production
                    }}
                    sx={{ flex: 1 }}
                  >
                    Add Points
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setCreditData({ amount: 0, reason: '' });
                      // Would open a dialog in production
                    }}
                    sx={{ flex: 1 }}
                  >
                    Add Credit
                  </Button>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box>
                <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                  PURCHASE HISTORY
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {purchaseHistory.length > 0 ? (
                    purchaseHistory.slice(0, 5).map((item, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          p: 1.5,
                          backgroundColor: '#F5F3ED',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            Invoice #{item.invoiceId?.invoiceNumber}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#9AA0C0', display: 'block' }}>
                            {new Date(item.date).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#1B1F3B' }}>
                          ₹{(item.amount || 0).toFixed(0)}
                        </Typography>
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
                      No purchases yet
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setShowDetail(false);
                handleOpenForm(selectedCustomer);
              }}
            >
              Edit Customer
            </Button>
          </Box>
        )}
      </Drawer>
    </Layout>
  );
};

export default Customers;
