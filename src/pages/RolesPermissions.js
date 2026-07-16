import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Box, Table, TableBody, TableCell, TableHead, TableRow, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, FormGroup, FormControlLabel, Checkbox,
  Chip, Grid, CircularProgress, Alert,
} from '@mui/material';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';

const emptyForm = { name: '', description: '', permissions: {} };

const RolesPermissions = () => {
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/roles');
      const rolesList = Array.isArray(response.data) ? response.data : (response.data.roles || []);
      setRoles(rolesList);
    } catch (err) {
      setError('Failed to load roles');
      console.error('Error fetching roles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPermissions = useCallback(async () => {
    try {
      const response = await api.get('/roles/permissions');
      const list = Array.isArray(response.data) ? response.data : (response.data.permissions || []);
      // Normalize module keys to a friendly label
      setModules(list.map((m) => ({
        name: m.module,
        label: m.module.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        actions: m.actions || [],
      })));
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, [fetchRoles, fetchPermissions]);

  const permissionsArrayToMap = (permissionsArray = []) => {
    const map = {};
    permissionsArray.forEach((p) => {
      map[p.module] = [...(p.actions || [])];
    });
    return map;
  };

  const permissionsMapToArray = (permissionsMap = {}) =>
    Object.entries(permissionsMap)
      .filter(([, actions]) => actions && actions.length > 0)
      .map(([module, actions]) => ({ module, actions }));

  const handleOpenForm = (role = null) => {
    setError('');
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name || '',
        description: role.description || '',
        permissions: permissionsArrayToMap(role.permissions),
      });
    } else {
      setEditingRole(null);
      setFormData(emptyForm);
    }
    setOpenForm(true);
  };

  const togglePermission = (module, action) => {
    setFormData((prev) => {
      const current = prev.permissions[module] || [];
      const updated = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, permissions: { ...prev.permissions, [module]: updated } };
    });
  };

  const isChecked = (module, action) => (formData.permissions[module] || []).includes(action);

  const handleSaveRole = async () => {
    try {
      if (!formData.name.trim()) {
        setError('Please enter a role name');
        return;
      }
      setSaving(true);
      setError('');

      const payload = {
        name: formData.name,
        description: formData.description,
        permissions: permissionsMapToArray(formData.permissions),
      };

      if (editingRole) {
        await api.put(`/roles/${editingRole._id}`, payload);
      } else {
        await api.post('/roles', payload);
      }

      setOpenForm(false);
      setFormData(emptyForm);
      setEditingRole(null);
      await fetchRoles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save role');
      console.error('Error saving role:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      setError('');
      await api.delete(`/roles/${roleId}`);
      await fetchRoles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete role');
      console.error('Error deleting role:', err);
    }
  };

  if (loading && roles.length === 0) {
    return (
      <Layout title="Roles & Permissions">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Roles & Permissions">
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card sx={{ padding: '24px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Roles</Typography>
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => handleOpenForm()}>Add Role</Button>
            </Box>

            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
                  <TableCell sx={{ fontWeight: 700 }}>ROLE NAME</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>DESCRIPTION</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">ACTION</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ color: '#9AA0C0', py: 4 }}>
                      No roles found. Click "Add Role" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow key={role._id}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {role.name}
                        {role.isPreDefined && (
                          <Chip label="Predefined" size="small" sx={{ ml: 1, height: 20, fontSize: 10 }} />
                        )}
                      </TableCell>
                      <TableCell>{role.description}</TableCell>
                      <TableCell align="center">
                        <Button variant="text" size="small" onClick={() => handleOpenForm(role)}>
                          <Edit2 size={16} />
                        </Button>
                        {!role.isPreDefined && (
                          <Button variant="text" size="small" sx={{ color: '#C24A3D' }} onClick={() => handleDeleteRole(role._id)}>
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ padding: '24px' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Permission Matrix</Typography>
            {modules.map((module) => (
              <Box key={module.name} sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>{module.label.toUpperCase()}</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                  {module.actions.map((action) => (
                    <Chip key={action} label={action} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
            ))}
          </Card>
        </Grid>
      </Grid>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField fullWidth label="Role Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} size="small" />
            <TextField fullWidth label="Description" multiline rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} size="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2 }}>Permissions</Typography>
            <FormGroup>
              {modules.map((module) => (
                <Box key={module.name} sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{module.label}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                    {module.actions.map((action) => (
                      <FormControlLabel
                        key={action}
                        control={
                          <Checkbox
                            size="small"
                            checked={isChecked(module.name, action)}
                            onChange={() => togglePermission(module.name, action)}
                          />
                        }
                        label={action}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </FormGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSaveRole} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default RolesPermissions;
