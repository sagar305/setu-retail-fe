import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Card, Typography, Box, Table, TableBody, TableCell, TableHead, TableRow, Button, Chip, CircularProgress, Alert } from '@mui/material';
import { Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { OutletContext } from '../context/OutletContext';
import api from '../services/api';

const Notifications = () => {
  const { selectedOutlet } = useContext(OutletContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = selectedOutlet ? { outletId: selectedOutlet._id } : {};
      const response = await api.get('/notifications', { params });
      const notificationsList = Array.isArray(response.data) ? response.data : (response.data.notifications || []);
      setNotifications(notificationsList);
    } catch (err) {
      setError('Failed to load notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedOutlet]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleDeleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      await fetchNotifications();
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getTypeColor = (type) => {
    const colors = { alert: '#C24A3D', success: '#2F8F5B', info: '#1B1F3B', warning: '#F2A03D' };
    return colors[type] || '#9AA0C0';
  };

  if (loading) {
    return (
      <Layout title="Notifications">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Notifications">
      <Card sx={{ padding: '24px' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Notifications</Typography>
          {notifications.filter(n => !n.read).length > 0 && (
            <Chip label={`${notifications.filter(n => !n.read).length} Unread`} sx={{ backgroundColor: '#C24A3D', color: '#FFF' }} />
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {notifications.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: '#9AA0C0' }}>
            No notifications
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
                <TableCell sx={{ fontWeight: 700 }}>TYPE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>MESSAGE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">ACTION</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {notifications.map((notif) => (
                <TableRow key={notif._id} sx={{ backgroundColor: !notif.read ? '#F5F3ED' : 'transparent' }}>
                  <TableCell>
                    <Chip label={notif.type.toUpperCase()} size="small" sx={{ color: getTypeColor(notif.type) }} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: !notif.read ? 700 : 400 }}>{notif.message}</TableCell>
                  <TableCell>{new Date(notif.date).toLocaleDateString()}</TableCell>
                  <TableCell align="center">
                    <Button variant="text" size="small" onClick={() => handleDeleteNotification(notif._id)}><Trash2 size={16} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </Layout>
  );
};

export default Notifications;
