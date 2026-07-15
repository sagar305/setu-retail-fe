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
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
} from '@mui/material';
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { OutletContext } from '../context/OutletContext';
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

const Expenses = () => {
  const { selectedOutlet } = useContext(OutletContext);
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState({});
  const [openForm, setOpenForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    category: 'general',
    date: new Date().toISOString().split('T')[0],
    note: '',
    attachmentUrl: '',
  });

  useEffect(() => {
    const loadData = async () => {
      await fetchExpenses();
      await fetchStats();
    };
    loadData();
  }, [searchQuery, statusFilter, page, rowsPerPage, selectedOutlet]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        search: searchQuery,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        skip: page * rowsPerPage,
        limit: rowsPerPage,
      };
      if (selectedOutlet) {
        params.outletId = selectedOutlet._id;
      }
      const response = await api.get('/expenses', { params });
      const expensesList = Array.isArray(response.data) ? response.data : (response.data.expenses || []);
      setExpenses(expensesList);
      setTotal(response.data.total || expensesList.length);
    } catch (err) {
      setError('Failed to load expenses');
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = selectedOutlet ? { outletId: selectedOutlet._id } : {};
      const response = await api.get('/expenses/stats/all', { params });
      setStats(response.data || {});
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleOpenForm = (expense = null) => {
    setError('');
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
        note: expense.note || '',
        attachmentUrl: expense.attachmentUrl || '',
      });
    } else {
      setEditingExpense(null);
      setFormData({
        description: '',
        amount: 0,
        category: 'general',
        date: new Date().toISOString().split('T')[0],
        note: '',
        attachmentUrl: '',
      });
    }
    setOpenForm(true);
  };

  const handleSaveExpense = async () => {
    try {
      if (!formData.description || !formData.amount) {
        setError('Please fill in description and amount');
        return;
      }

      setSaving(true);
      setError('');

      if (editingExpense) {
        await api.put(`/expenses/${editingExpense._id}`, formData);
      } else {
        await api.post('/expenses', formData);
      }

      setOpenForm(false);
      await fetchExpenses();
      await fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save expense');
      console.error('Error saving expense:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        setError('');
        await api.delete(`/expenses/${expenseId}`);
        await fetchExpenses();
        await fetchStats();
      } catch (err) {
        setError('Failed to delete expense');
        console.error('Error deleting expense:', err);
      }
    }
  };

  const handleApproveExpense = async (expenseId) => {
    try {
      setError('');
      await api.put(`/expenses/${expenseId}/approve`);
      await fetchExpenses();
      await fetchStats();
    } catch (err) {
      setError('Failed to approve expense');
      console.error('Error approving expense:', err);
    }
  };

  const handleRejectExpense = async (expenseId) => {
    try {
      setError('');
      await api.put(`/expenses/${expenseId}/reject`);
      await fetchExpenses();
      await fetchStats();
    } catch (err) {
      setError('Failed to reject expense');
      console.error('Error rejecting expense:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return '#2F8F5B';
      case 'rejected':
        return '#C24A3D';
      default:
        return '#F2A03D';
    }
  };

  const categories = [
    'general',
    'rent',
    'utilities',
    'salary',
    'maintenance',
    'supplies',
    'marketing',
    'travel',
    'equipment',
  ];

  if (loading && expenses.length === 0) {
    return (
      <Layout title="Expenses">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Expenses">
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL EXPENSES" value={`₹${(stats.totalExpenses || 0).toFixed(0)}`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="PENDING" value={stats.pendingCount || 0} color="#F2A03D" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="APPROVED" value={stats.approvedCount || 0} color="#2F8F5B" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="REJECTED" value={stats.rejectedCount || 0} color="#C24A3D" />
        </Grid>
      </Grid>

      <Card sx={{ padding: '24px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: '300px' }}>
            <TextField
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              size="small"
              fullWidth
              disabled={loading}
            />
            <FormControl size="small" sx={{ minWidth: '120px' }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                disabled={loading}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => handleOpenForm()}
            disabled={loading}
          >
            Add Expense
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>DESCRIPTION</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>CATEGORY</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                AMOUNT
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                ACTIONS
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: '#9AA0C0' }}>
                  No expenses found
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense) => (
                <TableRow key={expense._id} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                  <TableCell sx={{ fontWeight: 600 }}>{expense.description}</TableCell>
                  <TableCell>
                    <Chip label={expense.category.toUpperCase()} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    ₹{expense.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip
                      label={(expense.status || 'pending').toUpperCase()}
                      size="small"
                      sx={{
                        backgroundColor: getStatusColor(expense.status) + '20',
                        color: getStatusColor(expense.status),
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {expense.status === 'pending' && (
                      <>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => handleOpenForm(expense)}
                          sx={{ color: '#1B1F3B' }}
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => handleApproveExpense(expense._id)}
                          sx={{ color: '#2F8F5B' }}
                          title="Approve"
                        >
                          <CheckCircle size={16} />
                        </Button>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => handleRejectExpense(expense._id)}
                          sx={{ color: '#C24A3D' }}
                          title="Reject"
                        >
                          <XCircle size={16} />
                        </Button>
                      </>
                    )}
                    {expense.status !== 'pending' && (
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => handleDeleteExpense(expense._id)}
                        sx={{ color: '#C24A3D' }}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
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
        <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              fullWidth
              label="Description *"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="Amount *"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              size="small"
              inputProps={{ step: '0.01', min: '0' }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label="Note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              size="small"
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSaveExpense} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : (editingExpense ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Expenses;
