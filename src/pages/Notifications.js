import React, { useState } from 'react';
import { Card, Typography, Box, Table, TableBody, TableCell, TableHead, TableRow, Button, Chip } from '@mui/material';
import { Trash2, Eye } from 'lucide-react';
import Layout from '../components/Layout';

const Notifications = () => {
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'alert', message: 'Low stock: Product A', date: new Date(), read: false },
    { id: 2, type: 'success', message: 'Invoice created successfully', date: new Date(), read: true },
    { id: 3, type: 'info', message: 'Purchase order approved', date: new Date(), read: true },
  ]);

  const getTypeColor = (type) => {
    const colors = { alert: '#C24A3D', success: '#2F8F5B', info: '#1B1F3B', warning: '#F2A03D' };
    return colors[type] || '#9AA0C0';
  };

  return (
    <Layout title="Notifications">
      <Card sx={{ padding: '24px' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Notifications</Typography>
          {notifications.filter(n => !n.read).length > 0 && (
            <Chip label={`${notifications.filter(n => !n.read).length} Unread`} sx={{ backgroundColor: '#C24A3D', color: '#FFF' }} />
          )}
        </Box>

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
              <TableRow key={notif.id} sx={{ backgroundColor: !notif.read ? '#F5F3ED' : 'transparent' }}>
                <TableCell>
                  <Chip label={notif.type.toUpperCase()} size="small" sx={{ color: getTypeColor(notif.type) }} />
                </TableCell>
                <TableCell sx={{ fontWeight: !notif.read ? 700 : 400 }}>{notif.message}</TableCell>
                <TableCell>{notif.date.toLocaleDateString()}</TableCell>
                <TableCell align="center">
                  <Button variant="text" size="small"><Trash2 size={16} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Layout>
  );
};

export default Notifications;
