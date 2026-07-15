import React, { useState } from 'react';
import {
  Card, Typography, Box, Table, TableBody, TableCell, TableHead, TableRow, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, FormGroup, FormControlLabel, Checkbox, Chip, Grid
} from '@mui/material';
import { Plus, Edit2 } from 'lucide-react';
import Layout from '../components/Layout';

const RolesPermissions = () => {
  const [roles] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [selectedRole] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', permissions: {} });

  const modules = [
    { name: 'Products', actions: ['view', 'create', 'edit', 'delete'] },
    { name: 'Inventory', actions: ['view', 'adjust', 'transfer'] },
    { name: 'Invoices', actions: ['view', 'create', 'edit', 'delete'] },
    { name: 'Reports', actions: ['view', 'export'] },
    { name: 'Settings', actions: ['view', 'edit'] },
  ];

  const handleSaveRole = async () => {
    try {
      setOpenForm(false);
      alert('Role saved!');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <Layout title="Roles & Permissions">
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card sx={{ padding: '24px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Roles</Typography>
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setOpenForm(true)}>Add Role</Button>
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
                {roles.map((role) => (
                  <TableRow key={role._id}>
                    <TableCell sx={{ fontWeight: 600 }}>{role.name}</TableCell>
                    <TableCell>{role.description}</TableCell>
                    <TableCell align="center">
                      <Button variant="text" size="small"><Edit2 size={16} /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ padding: '24px' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Permission Matrix</Typography>
            {modules.map((module) => (
              <Box key={module.name} sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>{module.name.toUpperCase()}</Typography>
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
        <DialogTitle>{selectedRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Role Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <TextField fullWidth label="Description" multiline rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2 }}>Permissions</Typography>
            <FormGroup>
              {modules.map((module) => (
                <Box key={module.name}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{module.name}</Typography>
                  {module.actions.map((action) => (
                    <FormControlLabel key={action} control={<Checkbox />} label={action} />
                  ))}
                </Box>
              ))}
            </FormGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancel</Button>
          <Button onClick={handleSaveRole} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default RolesPermissions;
