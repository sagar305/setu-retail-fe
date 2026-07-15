import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const OutletContext = createContext();

export const OutletProvider = ({ children }) => {
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOutlets();
  }, []);

  const fetchOutlets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/outlets');
      const outletsList = Array.isArray(response.data) ? response.data : (response.data.outlets || []);
      setOutlets(outletsList);

      // Auto-select first outlet if available
      if (outletsList.length > 0 && !selectedOutlet) {
        setSelectedOutlet(outletsList[0]);
      }
    } catch (err) {
      console.error('Error fetching outlets:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectOutlet = (outlet) => {
    setSelectedOutlet(outlet);
    localStorage.setItem('selectedOutletId', outlet._id);
  };

  return (
    <OutletContext.Provider value={{ outlets, selectedOutlet, selectOutlet, loading, fetchOutlets }}>
      {children}
    </OutletContext.Provider>
  );
};
