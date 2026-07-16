import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Box, Grid, Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, FormControl,
  InputLabel, Select, MenuItem, TablePagination, Alert, CircularProgress, Chip,
} from '@mui/material';
import { Plus, Edit2 } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';

const StatCard = ({ label, value }) => (
  <Card sx={{ padding: '24px' }}>
    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>{label}</Typography>
    <Typography variant="h5" sx={{ fontWeight: 700, my: 1 }}>{value}</Typography>
  </Card>
);

const emptyForm = { name: '', email: '', phone: '', roleId: '', outlet: '' };

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState(null);

  const [formData, setFormData] = useState(emptyForm);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      const list = Array.isArray(response.data) ? response.data : (response.data.users || []);
      setEmployees(list);
    } catch (err) {
      setError('Failed to load employees');
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const response = await api.get('/roles');
      setRoles(Array.isArray(response.data) ? response.data : (response.data.roles || []));
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  }, []);

  const fetchOutlets = useCallback(async () => {
    try {
      const response = await api.get('/outlets');
      setOutlets(Array.isArray(response.data) ? response.data : (response.data.outlets || []));
    } catch (err) {
      console.error('Error fetching outlets:', err);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
    fetchOutlets();
  }, [fetchEmployees, fetchRoles, fetchOutlets]);

  const handleOpenForm = (employee = null) => {
    setError('');
    setTempPassword(null);
    if (employee) {
      setSelectedEmployee(employee);
      setFormData({
        name: employee.name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        roleId: employee.role?._id || '',
        outlet: employee.outlet?._id || '',
      });
    } else {
      setSelectedEmployee(null);
      setFormData(emptyForm);
    }
    setOpenForm(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.email) {
        setError('Please fill in name and email');
        return;
      }
      setSaving(true);
      setError('');

      if (selectedEmployee) {
        await api.put(`/users/${selectedEmployee._id}`, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.roleId || undefined,
          outlet: formData.outlet || undefined,
        });
        setOpenForm(false);
      } else {
        const response = await api.post('/users', {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          roleId: formData.roleId || undefined,
          outlet: formData.outlet || undefined,
        });
        setOpenForm(false);
        // Owner must share this with the new employee — it's shown once
        setTempPassword({ email: formData.email, password: response.data.tempPassword });
      }
      await fetchEmployees();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save employee');
      console.error('Error saving employee:', err);
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = (searchQuery || '').toLowerCase();
    return (
      (emp.name || '').toLowerCase().includes(q) ||
      (emp.email || '').toLowerCase().includes(q)
    );
  });

  const pagedEmployees = filteredEmployees.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading && employees.length === 0) {
    return (
      <Layout title="Employees">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Employees">
      {error && !openForm && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>
      )}
      {tempPassword && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setTempPassword(null)}>
          Employee created. Temporary password for <strong>{tempPassword.email}</strong>:{' '}
          <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{tempPassword.password}</strong>
          {' '}— share it with them so they can log in (shown only once).
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL EMPLOYEES" value={employees.length} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="ASSIGNED TO OUTLETS" value={employees.filter((e) => e.outlet).length} />
        </Grid>
      </Grid>

      <Card sx={{ padding: '24px', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <TextField
            placeholder="Search employees..."
            size="small"
            fullWidth
            sx={{ maxWidth: 300 }}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          />
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => handleOpenForm()}>Add Employee</Button>
        </Box>

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>NAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>EMAIL</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ROLE</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>OUTLET</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">ACTION</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ color: '#9AA0C0', py: 4 }}>
                  No employees found. Click "Add Employee" to create one.
                </TableCell>
              </TableRow>
            ) : (
              pagedEmployees.map((emp) => (
                <TableRow key={emp._id}>
                  <TableCell sx={{ fontWeight: 600 }}>{emp.name}</TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>
                    {emp.role?.name ? (
                      <Chip label={emp.role.name} size="small" />
                    ) : (
                      <Typography variant="caption" sx={{ color: '#9AA0C0' }}>—</Typography>
                    )}
                  </TableCell>
                  <TableCell>{emp.outlet?.name || '—'}</TableCell>
                  <TableCell align="center">
                    <Button variant="text" size="small" onClick={() => handleOpenForm(emp)}>
                      <Edit2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredEmployees.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, np) => setPage(np)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </Card>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField fullWidth label="Name *" size="small" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <TextField fullWidth label="Email *" size="small" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            <TextField fullWidth label="Phone" size="small" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            <FormControl fullWidth size="small">
              <InputLabel>Role</InputLabel>
              <Select value={formData.roleId} label="Role" onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}>
                {roles.map((r) => <MenuItem key={r._id} value={r._id}>{r.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Outlet</InputLabel>
              <Select value={formData.outlet} label="Outlet" onChange={(e) => setFormData({ ...formData, outlet: e.target.value })}>
                <MenuItem value="">No outlet</MenuItem>
                {outlets.map((o) => <MenuItem key={o._id} value={o._id}>{o.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Employees;
