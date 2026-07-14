import React from 'react';
import { Box, Chip, CircularProgress, Tooltip } from '@mui/material';
import { Wifi, WifiOff, Cloud, CloudOff } from 'lucide-react';
import useOffline from '../hooks/useOffline';

const OfflineSyncStatus = () => {
  const { isOnline, isSyncing, unsyncedCount, syncNow, syncError } = useOffline();

  const handleSync = () => {
    syncNow();
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Tooltip title={isOnline ? 'Online' : 'Offline'}>
        <Chip
          icon={isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
          label={isOnline ? 'Online' : 'Offline'}
          size="small"
          variant="outlined"
          color={isOnline ? 'success' : 'error'}
        />
      </Tooltip>

      {unsyncedCount > 0 && (
        <Tooltip title={`${unsyncedCount} unsynced items. Click to sync now.`}>
          <Chip
            icon={isSyncing ? <CircularProgress size={18} /> : <CloudOff size={18} />}
            label={unsyncedCount}
            size="small"
            variant="filled"
            color="warning"
            onClick={handleSync}
            disabled={isSyncing || !isOnline}
          />
        </Tooltip>
      )}

      {syncError && (
        <Tooltip title={syncError}>
          <Chip label="Sync Error" size="small" variant="filled" color="error" />
        </Tooltip>
      )}

      {isOnline && unsyncedCount === 0 && (
        <Tooltip title="All data synced">
          <Chip
            icon={<Cloud size={18} />}
            label="Synced"
            size="small"
            variant="outlined"
            color="success"
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default OfflineSyncStatus;
