import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { SSEProvider } from './context/SSEContext';
import { OfflineProvider } from './context/OfflineContext';
import indexedDB from './services/indexedDB';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import POSBilling from './pages/POSBilling';
import WeighingCounter from './pages/WeighingCounter';
import ProductMaster from './pages/ProductMaster';
import Inventory from './pages/Inventory';
import PurchaseOrders from './pages/PurchaseOrders';
import StockTransfer from './pages/StockTransfer';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Employees from './pages/Employees';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Notifications from './pages/Notifications';
import RolesPermissions from './pages/RolesPermissions';
import Settings from './pages/Settings';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1B1F3B',
    },
    secondary: {
      main: '#F2A03D',
    },
    background: {
      default: '#F5F3ED',
    },
  },
  typography: {
    fontFamily: 'Sora, -apple-system, BlinkMacSystemFont, sans-serif',
  },
});

const PrivateRoute = ({ children }) => {
  const { token, loading } = useContext(AuthContext);

  if (loading) return <div>Loading...</div>;
  return token ? children : <Navigate to="/login" />;
};

function AppContent() {
  return (
    <ThemeProvider theme={theme}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/pos-billing"
          element={
            <PrivateRoute>
              <POSBilling />
            </PrivateRoute>
          }
        />
        <Route
          path="/weighing-counter"
          element={
            <PrivateRoute>
              <WeighingCounter />
            </PrivateRoute>
          }
        />
        <Route
          path="/product-master"
          element={
            <PrivateRoute>
              <ProductMaster />
            </PrivateRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <PrivateRoute>
              <Inventory />
            </PrivateRoute>
          }
        />
        <Route
          path="/purchase-orders"
          element={
            <PrivateRoute>
              <PurchaseOrders />
            </PrivateRoute>
          }
        />
        <Route
          path="/stock-transfer"
          element={
            <PrivateRoute>
              <StockTransfer />
            </PrivateRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <PrivateRoute>
              <Customers />
            </PrivateRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <PrivateRoute>
              <Suppliers />
            </PrivateRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <PrivateRoute>
              <Employees />
            </PrivateRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <PrivateRoute>
              <Reports />
            </PrivateRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <PrivateRoute>
              <Expenses />
            </PrivateRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <PrivateRoute>
              <Notifications />
            </PrivateRoute>
          }
        />
        <Route
          path="/roles-permissions"
          element={
            <PrivateRoute>
              <RolesPermissions />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </ThemeProvider>
  );
}

function App() {
  useEffect(() => {
    indexedDB.init().catch((error) => console.error('IndexedDB init error:', error));
  }, []);

  return (
    <Router>
      <AuthProvider>
        <OfflineProvider>
          <SSEProvider>
            <AppContent />
          </SSEProvider>
        </OfflineProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
