import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  Box,
  Card,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import { AuthContext } from '../context/AuthContext';
import { OutletContext } from '../context/OutletContext';
import api from '../services/api';

const StatCard = ({ label, value, change, isPositive = true, color = '#22c55e' }) => (
  <Card sx={{ padding: '24px', backgroundColor: '#FFFFFF', borderRadius: '9px', boxShadow: '0 1px 3px rgba(27,31,59,0.08)' }}>
    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600, textTransform: 'uppercase' }}>
      {label}
    </Typography>
    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#1e293b' }}>
      {value}
    </Typography>
    {change && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isPositive ? (
          <TrendingUp size={16} color={color} />
        ) : (
          <TrendingDown size={16} color={color} />
        )}
        <Typography variant="caption" sx={{ color }}>
          {change}
        </Typography>
      </Box>
    )}
  </Card>
);

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const { selectedOutlet } = useContext(OutletContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [openOutletForm, setOpenOutletForm] = useState(false);
  const [openEmployeeForm, setOpenEmployeeForm] = useState(false);
  const [savingOutlet, setSavingOutlet] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [outletError, setOutletError] = useState('');
  const [employeeError, setEmployeeError] = useState('');

  const [outletFormData, setOutletFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    description: '',
    isActive: true,
  });

  const [employeeFormData, setEmployeeFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'cashier',
    salary: 0,
  });

  useEffect(() => {
    fetchDashboard();
    fetchOutlets();
  }, [selectedOutlet]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const params = selectedOutlet ? { outletId: selectedOutlet._id } : {};
      const response = await api.get('/dashboard', { params });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchOutlets = async () => {
    try {
      const response = await api.get('/outlets');
      const outletsList = Array.isArray(response.data) ? response.data : (response.data.outlets || []);
      setOutlets(outletsList);
    } catch (err) {
      console.error('Error fetching outlets:', err);
    }
  };

  const handleSaveOutlet = async () => {
    try {
      if (!outletFormData.name || !outletFormData.phone) {
        setOutletError('Please fill in outlet name and phone');
        return;
      }

      setSavingOutlet(true);
      setOutletError('');

      await api.post('/outlets', outletFormData);

      setOpenOutletForm(false);
      setOutletFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        description: '',
        isActive: true,
      });
      await fetchOutlets();
    } catch (err) {
      setOutletError(err.response?.data?.message || 'Failed to save outlet');
      console.error('Error saving outlet:', err);
    } finally {
      setSavingOutlet(false);
    }
  };

  const handleSaveEmployee = async () => {
    try {
      if (!employeeFormData.name || !employeeFormData.email) {
        setEmployeeError('Please fill in name and email');
        return;
      }

      setSavingEmployee(true);
      setEmployeeError('');

      await api.post('/employees', employeeFormData);

      setOpenEmployeeForm(false);
      setEmployeeFormData({
        name: '',
        email: '',
        phone: '',
        role: 'cashier',
        salary: 0,
      });
    } catch (err) {
      setEmployeeError(err.response?.data?.message || 'Failed to save employee');
      console.error('Error saving employee:', err);
    } finally {
      setSavingEmployee(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Failed to load dashboard data'}</Alert>
      </Box>
    );
  }

  const formatCurrency = (num) => {
    if (num === undefined || num === null) {
      return '₹0';
    }
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(2)}L`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  };

  return (
    <Layout title="Dashboard">
      <Box sx={{ px: 3, pt: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Welcome back, {user?.name}
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Top Metrics Row 1 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Today's Sales" value={formatCurrency(data.sales.today)} change="▲ 12% vs yesterday" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="This Week" value={formatCurrency(data.sales.week)} change="▲ 8% vs last week" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="This Month" value={formatCurrency(data.sales.month)} change="▲ 11% vs last month" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="This Year" value={formatCurrency(data.sales.year)} change="▲ 18% vs last year" />
        </Grid>
      </Grid>

      {/* Financial Metrics Row 2 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Profit (Today)" value={formatCurrency(data.financial.profit)} subtitle="31.9% margin" color="#ef4444" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Revenue (Month)" value={formatCurrency(data.financial.revenue)} change="Before expenses" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Expenses (Month)" value={formatCurrency(data.financial.expenses)} change="Rent, salary, utilities" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Pending Payments" value={data.financial.pendingPayments} change={`Owed to 2 suppliers`} color="#f59e0b" />
        </Grid>
      </Grid>

      {/* Operational Metrics Row 3 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Transactions" value={data.metrics.transactions} change="▲ 6% vs yesterday" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Avg Basket" value={formatCurrency(data.metrics.avgBasket)} change="▼ 2% vs yesterday" isPositive={false} color="#ef4444" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 3, backgroundColor: '#FFFFFF', borderRadius: '9px' }}>
            <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600, textTransform: 'uppercase' }}>
              Low Stock Items
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#f59e0b' }}>
              {data.metrics.lowStockCount}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Across {outlets.length} outlets
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 3, backgroundColor: '#FFFFFF', borderRadius: '9px' }}>
            <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600, textTransform: 'uppercase' }}>
              Out of Stock
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#ef4444' }}>
              {data.metrics.outOfStockCount}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Needs reorder
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions and Outlets Section */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => setOpenOutletForm(true)}
          sx={{ backgroundColor: '#2F8F5B' }}
        >
          New Outlet
        </Button>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => setOpenEmployeeForm(true)}
          sx={{ backgroundColor: '#1B5E8F' }}
        >
          New Employee
        </Button>
      </Box>

      {/* Outlets Summary */}
      {outlets.length > 0 && (
        <Card sx={{ p: 3, backgroundColor: '#FFFFFF', borderRadius: '9px', mb: 3 }}>
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 2 }}>
            Your Outlets ({outlets.length})
          </Typography>
          <Grid container spacing={2}>
            {outlets.slice(0, 4).map((outlet) => (
              <Grid item xs={12} sm={6} md={3} key={outlet._id}>
                <Card sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #2F8F5B' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {outlet.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {outlet.city}, {outlet.state}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: '#9AA0C0', mt: 1 }}>
                    {outlet.phone}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Card>
      )}

      {/* Charts */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Sales Trend */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, backgroundColor: '#FFFFFF', borderRadius: '9px' }}>
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 2 }}>
              Sales trend - last 7 days
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.trends.salesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sales" fill="#1B1F3B" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Grid>

        {/* Category Performance */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, backgroundColor: '#FFFFFF', borderRadius: '9px' }}>
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 2 }}>
              Category performance
            </Typography>
            {data.trends.categoryPerformance.slice(0, 5).map((cat, idx) => (
              <Box key={idx} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {cat.name}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {cat.percentage}%
                  </Typography>
                </Box>
                <Box sx={{ width: '100%', height: 6, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ width: `${cat.percentage}%`, height: '100%', backgroundColor: '#1B1F3B' }} />
                </Box>
              </Box>
            ))}
          </Card>
        </Grid>
      </Grid>

      {/* Recent Sales Table */}
      <Card sx={{ backgroundColor: '#FFFFFF', borderRadius: '9px' }}>
        <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Recent Sales
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600, color: '#64748b' }}>Invoice</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#64748b' }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#64748b' }}>Time</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: '#64748b' }}>
                  Amount
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.recent.sales.map((sale, idx) => (
                <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                  <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>{sale.invoiceNumber}</TableCell>
                  <TableCell sx={{ color: '#475569' }}>{sale.customerName}</TableCell>
                  <TableCell sx={{ color: '#64748b' }}>{sale.time}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    {formatCurrency(sale.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add Outlet Dialog */}
      <Dialog open={openOutletForm} onClose={() => setOpenOutletForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Outlet</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {outletError && <Alert severity="error">{outletError}</Alert>}
            <TextField
              fullWidth
              label="Outlet Name *"
              value={outletFormData.name}
              onChange={(e) => setOutletFormData({ ...outletFormData, name: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="Phone *"
              value={outletFormData.phone}
              onChange={(e) => setOutletFormData({ ...outletFormData, phone: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={outletFormData.email}
              onChange={(e) => setOutletFormData({ ...outletFormData, email: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="City"
              value={outletFormData.city}
              onChange={(e) => setOutletFormData({ ...outletFormData, city: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="State"
              value={outletFormData.state}
              onChange={(e) => setOutletFormData({ ...outletFormData, state: e.target.value })}
              size="small"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={outletFormData.isActive}
                  onChange={(e) => setOutletFormData({ ...outletFormData, isActive: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenOutletForm(false)} disabled={savingOutlet}>
            Cancel
          </Button>
          <Button onClick={handleSaveOutlet} variant="contained" disabled={savingOutlet}>
            {savingOutlet ? 'Saving...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Employee Dialog */}
      <Dialog open={openEmployeeForm} onClose={() => setOpenEmployeeForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Employee</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {employeeError && <Alert severity="error">{employeeError}</Alert>}
            <TextField
              fullWidth
              label="Name *"
              value={employeeFormData.name}
              onChange={(e) => setEmployeeFormData({ ...employeeFormData, name: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="Email *"
              type="email"
              value={employeeFormData.email}
              onChange={(e) => setEmployeeFormData({ ...employeeFormData, email: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="Phone"
              value={employeeFormData.phone}
              onChange={(e) => setEmployeeFormData({ ...employeeFormData, phone: e.target.value })}
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEmployeeForm(false)} disabled={savingEmployee}>
            Cancel
          </Button>
          <Button onClick={handleSaveEmployee} variant="contained" disabled={savingEmployee}>
            {savingEmployee ? 'Saving...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Layout>
  );
};

export default Dashboard;
