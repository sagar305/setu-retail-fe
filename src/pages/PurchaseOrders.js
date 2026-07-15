import React, { useState, useEffect, useContext } from 'react';
import {
  Card, Typography, Box, Grid, Table, TableBody, TableCell, TableHead, TableRow,
  Button, Chip, TablePagination
} from '@mui/material';
import { Plus, Edit2 } from 'lucide-react';
import Layout from '../components/Layout';
import { OutletContext } from '../context/OutletContext';
import api from '../services/api';

const StatCard = ({ label, value, color = '#1B1F3B' }) => (
  <Card sx={{ padding: '24px' }}>
    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>{label}</Typography>
    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color }}>{value}</Typography>
  </Card>
);

const PurchaseOrders = () => {
  const { selectedOutlet } = useContext(OutletContext);
  const [pos, setPos] = useState([]);
  const [stats, setStats] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchPOs();
    fetchStats();
  }, [statusFilter, page, rowsPerPage, selectedOutlet]);

  const fetchPOs = async () => {
    try {
      const params = { status: statusFilter === 'all' ? undefined : statusFilter, skip: page * rowsPerPage, limit: rowsPerPage };
      if (selectedOutlet) params.outletId = selectedOutlet._id;
      const response = await api.get('/purchase-orders', { params });
      setPos(response.data.orders || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const params = selectedOutlet ? { outletId: selectedOutlet._id } : {};
      const response = await api.get('/purchase-orders/stats/all', { params });
      setStats(response.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = { draft: '#9AA0C0', confirmed: '#F2A03D', received: '#2F8F5B', invoiced: '#1B1F3B', cancelled: '#C24A3D' };
    return colors[status] || '#9AA0C0';
  };

  return (
    <Layout title="Purchase Orders">
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL POs" value={stats.totalOrders || 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="CONFIRMED" value={stats.confirmedCount || 0} color="#F2A03D" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="RECEIVED" value={stats.receivedCount || 0} color="#2F8F5B" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL VALUE" value={`₹${(stats.totalPurchaseValue || 0).toFixed(0)}`} />
        </Grid>
      </Grid>

      <Card sx={{ padding: '24px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {['all', 'draft', 'confirmed', 'received'].map(s => (
              <Chip key={s} label={s.toUpperCase()} onClick={() => setStatusFilter(s)} variant={statusFilter === s ? 'filled' : 'outlined'} />
            ))}
          </Box>
          <Button variant="contained" startIcon={<Plus size={16} />}>New PO</Button>
        </Box>

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>PO NUMBER</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>SUPPLIER</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">AMOUNT</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">ACTION</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pos.map((po) => (
              <TableRow key={po._id}>
                <TableCell sx={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{po.poNumber}</TableCell>
                <TableCell>{po.supplier?.name}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>₹{(po.grandTotal || 0).toFixed(0)}</TableCell>
                <TableCell><Chip label={po.status.toUpperCase()} sx={{ color: getStatusColor(po.status) }} size="small" /></TableCell>
                <TableCell align="center"><Button variant="text" size="small"><Edit2 size={16} /></Button></TableCell>
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
    </Layout>
  );
};

export default PurchaseOrders;
