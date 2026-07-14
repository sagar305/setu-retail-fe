import React, { createContext, useEffect, useState, useCallback } from 'react';
import indexedDB from '../services/indexedDB';
import api from '../services/api';

export const OfflineContext = createContext();

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const tenantId = localStorage.getItem('tenantId');

  const syncOfflineData = useCallback(async () => {
    if (!isOnline) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      const syncQueue = await indexedDB.getSyncQueue();
      const unsyncedInvoices = await indexedDB.getUnsyncedInvoices();

      if (unsyncedInvoices.length > 0) {
        for (const invoice of unsyncedInvoices) {
          try {
            await api.post('/invoices', invoice);
            await indexedDB.markInvoiceAsSynced(invoice._id);
          } catch (error) {
            console.error('Failed to sync invoice:', error);
            setSyncError(`Failed to sync invoice ${invoice.invoiceNumber}`);
          }
        }
      }

      if (syncQueue.length > 0) {
        for (const item of syncQueue) {
          if (!item.synced) {
            try {
              const { endpoint, data } = item;
              await api.post(endpoint, data);
              await indexedDB.markSyncQueueItemAsSynced(item.id);
            } catch (error) {
              console.error('Failed to sync queue item:', error);
            }
          }
        }
      }

      setUnsyncedCount(0);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncError('Sync failed: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineData]);

  useEffect(() => {
    const checkUnsyncedItems = async () => {
      const unsyncedInvoices = await indexedDB.getUnsyncedInvoices();
      const syncQueue = await indexedDB.getSyncQueue();
      const unsyncedQueue = syncQueue.filter((item) => !item.synced);
      setUnsyncedCount(unsyncedInvoices.length + unsyncedQueue.length);
    };

    checkUnsyncedItems();
    const interval = setInterval(checkUnsyncedItems, 5000);
    return () => clearInterval(interval);
  }, []);

  const saveOfflineInvoice = useCallback(
    async (invoiceData) => {
      try {
        const invoice = {
          ...invoiceData,
          _id: `offline-${Date.now()}`,
          tenantId,
          isOffline: true,
        };
        await indexedDB.saveInvoice(invoice);
        setUnsyncedCount((prev) => prev + 1);
        return invoice;
      } catch (error) {
        console.error('Error saving offline invoice:', error);
        throw error;
      }
    },
    [tenantId]
  );

  const getLocalData = useCallback(
    async (storeName) => {
      try {
        if (storeName === 'products') {
          return await indexedDB.getLocalProducts(tenantId);
        } else if (storeName === 'inventory') {
          return await indexedDB.getLocalInventory(tenantId);
        } else if (storeName === 'customers') {
          return await indexedDB.getLocalCustomers(tenantId);
        } else if (storeName === 'invoices') {
          return await indexedDB.getLocalInvoices(tenantId);
        }
        return [];
      } catch (error) {
        console.error('Error getting local data:', error);
        return [];
      }
    },
    [tenantId]
  );

  const syncNow = useCallback(async () => {
    await syncOfflineData();
  }, [syncOfflineData]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        syncError,
        unsyncedCount,
        saveOfflineInvoice,
        getLocalData,
        syncNow,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};
