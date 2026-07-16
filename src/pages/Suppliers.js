import React, { useState, useEffect, useContext } from 'react';
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
  Drawer,
  Divider,
  TablePagination,
} from '@mui/material';
import { Plus, Phone, Mail, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { OutletContext } from '../context/OutletContext';
import api from '../services/api';
import { useFeedback } from '../context/FeedbackContext';

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

const Suppliers = () => {
  const { toast, confirm } = useFeedback();
  const { selectedOutlet } = useContext(OutletContext);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState({});
  const [openForm, setOpenForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    gst: '',
    address: { street: '', city: '', state: '', pincode: '' },
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchSuppliers();
    fetchStats();
  }, [searchQuery, page, rowsPerPage, selectedOutlet]);

  const fetchSuppliers = async () => {
    try {
      const params = { search: searchQuery, skip: page * rowsPerPage, limit: rowsPerPage };
      if (selectedOutlet) params.outletId = selectedOutlet._id;
      const response = await api.get('/suppliers', { params });
      setSuppliers(response.data.suppliers || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const params = selectedOutlet ? { outletId: selectedOutlet._id } : {};
      const response = await api.get('/suppliers/stats/all', { params });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleOpenForm = (supplier = null) => {
    if (supplier) {
      setFormData(supplier);
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        gst: '',
        address: { street: '', city: '', state: '', pincode: '' },
      });
    }
    setSelectedSupplier(supplier);
    setOpenForm(true);
  };

  const handleSaveSupplier = async () => {
    try {
      if (selectedSupplier) {
        await api.put(`/suppliers/${selectedSupplier._id}`, formData);
      } else {
        await api.post('/suppliers', formData);
      }
      setOpenForm(false);
      fetchSuppliers();
      fetchStats();
    } catch (error) {
      console.error('Error saving supplier:', error);
    }
  };

  const handleDeleteSupplier = async (supplierId) => {
    const ok = await confirm({
      title: 'Delete supplier?',
      message: 'This supplier and their payment records link will be removed.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/suppliers/${supplierId}`);
      toast('Supplier deleted');
      fetchSuppliers();
      setShowDetail(false);
    } catch (error) {
      toast('Failed to delete supplier', 'error');
      console.error('Error deleting supplier:', error);
    }
  };

  const handleViewDetail = async (supplierId) => {
    try {
      const response = await api.get(`/suppliers/${supplierId}`);
      setSelectedSupplier(response.data);
      setShowDetail(true);
    } catch (error) {
      console.error('Error fetching supplier detail:', error);
    }
  };

  return (
    <Layout title="Suppliers">
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL SUPPLIERS" value={stats.totalSuppliers || 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="OUTSTANDING" value={`₹${(stats.totalOutstanding || 0).toFixed(0)}`} color="#C24A3D" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL PURCHASED" value={`₹${(stats.totalPurchased || 0).toFixed(0)}`} color="#F2A03D" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="AVG PURCHASE" value={`₹${(stats.averagePurchaseValue || 0).toFixed(0)}`} />
        </Grid>
      </Grid>

      <Card sx={{ padding: '24px', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2 }}>
          <TextField
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            size="small"
            fullWidth
            sx={{ flex: 1, minWidth: '300px' }}
          />
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => handleOpenForm()}>
            Add Supplier
          </Button>
        </Box>

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>NAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>PHONE</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                OUTSTANDING
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                ACTION
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier._id} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                <TableCell sx={{ fontWeight: 600 }}>{supplier.name}</TableCell>
                <TableCell sx={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>
                  {supplier.phone}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color: supplier.outstandingBalance > 0 ? '#C24A3D' : '#2F8F5B' }}>
                  ₹{supplier.outstandingBalance?.toFixed(0) || 0}
                </TableCell>
                <TableCell align="center">
                  <Button variant="text" size="small" onClick={() => handleViewDetail(supplier._id)} sx={{ color: '#1B1F3B' }}>
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
        <DialogTitle>{selectedSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} size="small" />
            <TextField fullWidth label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} size="small" />
            <TextField fullWidth label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} size="small" />
            <TextField fullWidth label="GST" value={formData.gst} onChange={(e) => setFormData({ ...formData, gst: e.target.value })} size="small" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancel</Button>
          <Button onClick={handleSaveSupplier} variant="contained">
            {selectedSupplier ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={showDetail} onClose={() => setShowDetail(false)} sx={{ width: 450 }}>
        {selectedSupplier && (
          <Box sx={{ width: 450, p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">{selectedSupplier.name}</Typography>
              <Button variant="text" size="small" onClick={() => handleDeleteSupplier(selectedSupplier._id)} sx={{ color: '#C24A3D' }}>
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
                    <Typography variant="body2">{selectedSupplier.phone}</Typography>
                  </Box>
                  {selectedSupplier.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Mail size={16} style={{ color: '#9AA0C0' }} />
                      <Typography variant="body2">{selectedSupplier.email}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                    OUTSTANDING
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#C24A3D' }}>
                    ₹{(selectedSupplier.outstandingBalance || 0).toFixed(0)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                    TOTAL PURCHASED
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#F2A03D' }}>
                    ₹{(selectedSupplier.totalPurchased || 0).toFixed(0)}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Button fullWidth variant="outlined" onClick={() => { setShowDetail(false); handleOpenForm(selectedSupplier); }}>
              Edit Supplier
            </Button>
          </Box>
        )}
      </Drawer>
    </Layout>
  );
};

export default Suppliers;
