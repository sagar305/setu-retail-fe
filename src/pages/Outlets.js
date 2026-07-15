import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Box,
  Grid,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  Alert,
  Drawer,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';

const Outlets = () => {
  const [outlets, setOutlets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState(null);
  const [showEmployeeManager, setShowEmployeeManager] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
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

  useEffect(() => {
    fetchOutlets();
    fetchEmployees();
  }, [searchQuery]);

  const fetchOutlets = async () => {
    try {
      setLoading(true);
      setError('');
      const params = searchQuery ? { search: searchQuery } : {};
      const response = await api.get('/outlets', { params });
      const outletsList = Array.isArray(response.data) ? response.data : (response.data.outlets || []);
      setOutlets(outletsList);
    } catch (err) {
      setError('Failed to load outlets');
      console.error('Error fetching outlets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      const employeesList = Array.isArray(response.data) ? response.data : (response.data.employees || []);
      setEmployees(employeesList);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const handleOpenForm = (outlet = null) => {
    setError('');
    if (outlet) {
      setEditingOutlet(outlet);
      setFormData({
        name: outlet.name,
        email: outlet.email || '',
        phone: outlet.phone || '',
        address: outlet.address || '',
        city: outlet.city || '',
        state: outlet.state || '',
        pincode: outlet.pincode || '',
        description: outlet.description || '',
        isActive: outlet.isActive !== false,
      });
    } else {
      setEditingOutlet(null);
      setFormData({
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
    }
    setOpenForm(true);
  };

  const handleSaveOutlet = async () => {
    try {
      if (!formData.name || !formData.phone) {
        setError('Please fill in outlet name and phone');
        return;
      }

      setSaving(true);
      setError('');

      if (editingOutlet) {
        await api.put(`/outlets/${editingOutlet._id}`, formData);
      } else {
        await api.post('/outlets', formData);
      }

      setOpenForm(false);
      await fetchOutlets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save outlet');
      console.error('Error saving outlet:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOutlet = async (outletId) => {
    if (window.confirm('Are you sure you want to delete this outlet?')) {
      try {
        setError('');
        await api.delete(`/outlets/${outletId}`);
        await fetchOutlets();
      } catch (err) {
        setError('Failed to delete outlet');
        console.error('Error deleting outlet:', err);
      }
    }
  };

  const handleShowEmployeeManager = (outlet) => {
    setSelectedOutlet(outlet);
    setShowEmployeeManager(true);
  };

  const handleAssignEmployee = async (outletId, employeeId) => {
    try {
      // This would typically call an API to assign an employee to an outlet
      // For now, we'll just show a success message
      alert('Employee assigned successfully');
      setShowEmployeeManager(false);
      await fetchOutlets();
    } catch (err) {
      setError('Failed to assign employee');
      console.error('Error assigning employee:', err);
    }
  };

  const filteredOutlets = outlets.filter((outlet) =>
    outlet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    outlet.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && outlets.length === 0) {
    return (
      <Layout title="Outlets">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Outlets">
      <Card sx={{ padding: '24px', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: '300px' }}>
            <TextField
              placeholder="Search by outlet name or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              fullWidth
              disabled={loading}
            />
          </Box>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => handleOpenForm()}
            disabled={loading}
          >
            Add Outlet
          </Button>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
      </Card>

      <Grid container spacing={2}>
        {filteredOutlets.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={{ padding: '24px', textAlign: 'center', color: '#9AA0C0' }}>
              No outlets found
            </Card>
          </Grid>
        ) : (
          filteredOutlets.map((outlet) => (
            <Grid item xs={12} sm={6} md={4} key={outlet._id}>
              <Card sx={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1B1F3B' }}>
                      {outlet.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9AA0C0' }}>
                      {outlet.city}, {outlet.state}
                    </Typography>
                  </Box>
                  <Chip
                    label={outlet.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    sx={{
                      backgroundColor: outlet.isActive ? '#E5F9F0' : '#FEE2E2',
                      color: outlet.isActive ? '#2F8F5B' : '#C24A3D',
                    }}
                  />
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ flex: 1, mb: 2 }}>
                  <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                    CONTACT
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {outlet.phone}
                  </Typography>
                  {outlet.email && (
                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#5F6478' }}>
                      {outlet.email}
                    </Typography>
                  )}

                  {outlet.description && (
                    <>
                      <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600, display: 'block', mt: 1 }}>
                        DETAILS
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, fontSize: '12px' }}>
                        {outlet.description}
                      </Typography>
                    </>
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Users size={14} />}
                    onClick={() => handleShowEmployeeManager(outlet)}
                    sx={{ flex: 1 }}
                  >
                    Assign
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleOpenForm(outlet)}
                    sx={{ color: '#1B1F3B' }}
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleDeleteOutlet(outlet._id)}
                    sx={{ color: '#C24A3D' }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingOutlet ? 'Edit Outlet' : 'Add New Outlet'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              fullWidth
              label="Outlet Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              size="small"
            />
            <TextField
              fullWidth
              label="Phone *"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              size="small"
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
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              size="small"
              multiline
              rows={2}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                flex={1}
                label="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="State"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Pincode"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                size="small"
                sx={{ flex: 1 }}
              />
            </Box>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              size="small"
              multiline
              rows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSaveOutlet} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : (editingOutlet ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={showEmployeeManager}
        onClose={() => setShowEmployeeManager(false)}
        sx={{ minWidth: 400 }}
      >
        {selectedOutlet && (
          <Box sx={{ width: 400, p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Assign Employees - {selectedOutlet.name}
            </Typography>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600, mb: 2 }}>
              AVAILABLE EMPLOYEES ({employees.length})
            </Typography>

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {employees.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
                  No employees available
                </Typography>
              ) : (
                employees.map((emp) => (
                  <Card
                    key={emp._id}
                    sx={{
                      p: 2,
                      mb: 1,
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: '#F5F3ED' },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {emp.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#9AA0C0' }}>
                          {emp.email || emp.phone}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleAssignEmployee(selectedOutlet._id, emp._id)}
                      >
                        Assign
                      </Button>
                    </Box>
                  </Card>
                ))
              )}
            </Box>

            <Button
              fullWidth
              variant="outlined"
              sx={{ mt: 2 }}
              onClick={() => setShowEmployeeManager(false)}
            >
              Close
            </Button>
          </Box>
        )}
      </Drawer>
    </Layout>
  );
};

export default Outlets;
