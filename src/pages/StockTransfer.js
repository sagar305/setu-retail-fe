import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Box, Grid, Table, TableBody, TableCell, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Chip, TablePagination
} from '@mui/material';
import { Plus, Edit2 } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';

const StatCard = ({ label, value, color = '#1B1F3B' }) => (
  <Card sx={{ padding: '24px' }}>
    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>{label}</Typography>
    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color }}>{value}</Typography>
  </Card>
);

const StockTransfer = () => {
  const [transfers, setTransfers] = useState([]);
  const [stats, setStats] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchTransfers();
    fetchStats();
  }, [statusFilter, page, rowsPerPage]);

  const fetchTransfers = async () => {
    try {
      const response = await api.get('/stock-transfers', {
        params: { status: statusFilter === 'all' ? undefined : statusFilter, skip: page * rowsPerPage, limit: rowsPerPage }
      });
      setTransfers(response.data.transfers || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/stock-transfers/stats/all');
      setStats(response.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = { draft: '#9AA0C0', requested: '#F2A03D', approved: '#1B1F3B', shipped: '#5F6478', received: '#2F8F5B', rejected: '#C24A3D' };
    return colors[status] || '#9AA0C0';
  };

  return (
    <Layout title="Stock Transfer">
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="TOTAL TRANSFERS" value={stats.totalTransfers || 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="PENDING" value={stats.requestedCount || 0} color="#F2A03D" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="SHIPPED" value={stats.shippedCount || 0} color="#5F6478" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="RECEIVED" value={stats.receivedCount || 0} color="#2F8F5B" />
        </Grid>
      </Grid>

      <Card sx={{ padding: '24px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['all', 'requested', 'approved', 'shipped', 'received'].map(s => (
              <Chip key={s} label={s.toUpperCase()} onClick={() => setStatusFilter(s)} variant={statusFilter === s ? 'filled' : 'outlined'} />
            ))}
          </Box>
          <Button variant="contained" startIcon={<Plus size={16} />}>New Transfer</Button>
        </Box>

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>TRANSFER #</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>FROM</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>TO</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ITEMS</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">ACTION</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transfers.map((t) => (
              <TableRow key={t._id}>
                <TableCell sx={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{t.transferNumber}</TableCell>
                <TableCell>{t.fromOutlet?.name}</TableCell>
                <TableCell>{t.toOutlet?.name}</TableCell>
                <TableCell>{t.items?.length || 0}</TableCell>
                <TableCell><Chip label={t.status.toUpperCase()} sx={{ color: getStatusColor(t.status) }} size="small" /></TableCell>
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

export default StockTransfer;
