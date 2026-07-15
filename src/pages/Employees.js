import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Box, Grid, Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, TablePagination
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

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'cashier',
    salary: 0,
  });

  const roles = ['admin', 'manager', 'cashier', 'inventory', 'support'];

  useEffect(() => {
    fetchEmployees();
  }, [page, rowsPerPage]);

  const fetchEmployees = async () => {
    try {
      // Placeholder - would fetch from /api/users
      setEmployees([]);
      setTotal(0);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSave = async () => {
    try {
      if (selectedEmployee) {
        // await api.put(`/users/${selectedEmployee._id}`, formData);
      } else {
        // await api.post('/users', formData);
      }
      setOpenForm(false);
      fetchEmployees();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <Layout title="Employees">
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL EMPLOYEES" value={employees.length} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="ACTIVE" value={employees.filter(e => e.status === 'active').length} />
        </Grid>
      </Grid>

      <Card sx={{ padding: '24px', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <TextField placeholder="Search employees..." size="small" fullWidth sx={{ maxWidth: 300 }} />
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setOpenForm(true)}>Add Employee</Button>
        </Box>

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>NAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>EMAIL</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ROLE</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">ACTION</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp._id}>
                <TableCell>{emp.name}</TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>{emp.role}</TableCell>
                <TableCell align="center">
                  <Button variant="text" size="small"><Edit2 size={16} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, np) => setPage(np)}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value))}
        />
      </Card>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <TextField fullWidth label="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select value={formData.role} label="Role" onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                {roles.map(r => <MenuItem key={r} value={r}>{r.toUpperCase()}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Employees;
