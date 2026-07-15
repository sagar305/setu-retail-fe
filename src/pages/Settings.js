import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Box,
  TextField,
  Button,
  Tabs,
  Tab,
  Grid,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Save } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';

const SettingSection = ({ title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
    <Box sx={{ backgroundColor: '#F5F3ED', p: 2, borderRadius: '9px' }}>
      {children}
    </Box>
  </Box>
);

const Settings = () => {
  const [tabValue, setTabValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [businessSettings, setBusinessSettings] = useState({
    businessName: '',
    registrationNumber: '',
    gstNumber: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  const [brandingSettings, setBrandingSettings] = useState({
    primaryColor: '#1B1F3B',
    secondaryColor: '#F2A03D',
    logoUrl: '',
    favicon: '',
  });

  const [taxSettings, setTaxSettings] = useState({
    gstPercentage: 18,
    enableTax: true,
    taxMethod: 'inclusive',
    multipleGST: true,
  });

  const [inventorySettings, setInventorySettings] = useState({
    enableLowStockAlert: true,
    lowStockThreshold: 10,
    enableExpiryTracking: true,
    enableBarcodeTracking: true,
  });

  const [printerSettings, setPrinterSettings] = useState({
    defaultPrinter: '',
    receiptFormat: 'thermal',
    autoClose: true,
    copies: 1,
  });

  const [cashDrawerSettings, setCashDrawerSettings] = useState({
    enableCashDrawer: false,
    brand: 'generic',
    connectionType: 'usb',
    port: 'COM1',
  });

  const [localizationSettings, setLocalizationSettings] = useState({
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    timezone: 'Asia/Kolkata',
    language: 'en',
    autoLogoutMinutes: 15,
  });

  const [auditSettings, setAuditSettings] = useState({
    enableAuditLog: true,
    enableUserActivity: true,
    retentionDays: 90,
    requireApprovalThreshold: 10000,
  });

  const [barcodeScaleSettings, setBarcodeScaleSettings] = useState({
    enableScale: false,
    scaleBrand: 'generic',
    scaleConnectionType: 'usb',
    scalePort: 'COM1',
    barcodePrefix: 'BAR',
    barcodeFormat: 'CODE128',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Load settings from API if available
      // For now, we'll use default values
      // const response = await api.get('/settings');
      setLoading(false);
    } catch (err) {
      console.error('Error loading settings:', err);
      setLoading(false);
    }
  };

  const handleSave = async (section) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // In a real app, you would call the API to save settings
      // await api.put(`/settings/${section}`, settingsData);

      setSuccess(`${section} settings saved successfully!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings');
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Settings">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Settings">
      <Card sx={{ padding: '24px' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Tabs
          value={tabValue}
          onChange={(e, nv) => {
            setTabValue(nv);
            setError('');
            setSuccess('');
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 3 }}
        >
          <Tab label="Business" />
          <Tab label="Branding" />
          <Tab label="Tax & Inventory" />
          <Tab label="Printer" />
          <Tab label="Cash Drawer" />
          <Tab label="Localization" />
          <Tab label="Audit & Security" />
          <Tab label="Barcode & Scale" />
        </Tabs>

        {/* Business Tab */}
        {tabValue === 0 && (
          <Box>
            <SettingSection title="Business Information">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Business Name"
                    value={businessSettings.businessName}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, businessName: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Registration Number"
                    value={businessSettings.registrationNumber}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, registrationNumber: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="GST Number"
                    value={businessSettings.gstNumber}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, gstNumber: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={businessSettings.email}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, email: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={businessSettings.phone}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, phone: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    multiline
                    rows={2}
                    value={businessSettings.address}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, address: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="City"
                    value={businessSettings.city}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, city: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="State"
                    value={businessSettings.state}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, state: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Pincode"
                    value={businessSettings.pincode}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, pincode: e.target.value })}
                    size="small"
                  />
                </Grid>
              </Grid>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={() => handleSave('business')}
                disabled={saving}
                sx={{ mt: 2 }}
              >
                Save Business Settings
              </Button>
            </SettingSection>
          </Box>
        )}

        {/* Branding Tab */}
        {tabValue === 1 && (
          <Box>
            <SettingSection title="Branding">
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Primary Color"
                    type="color"
                    value={brandingSettings.primaryColor}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, primaryColor: e.target.value })}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Secondary Color"
                    type="color"
                    value={brandingSettings.secondaryColor}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, secondaryColor: e.target.value })}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Logo URL"
                    value={brandingSettings.logoUrl}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, logoUrl: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Favicon URL"
                    value={brandingSettings.favicon}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, favicon: e.target.value })}
                    size="small"
                  />
                </Grid>
              </Grid>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={() => handleSave('branding')}
                disabled={saving}
                sx={{ mt: 2 }}
              >
                Save Branding Settings
              </Button>
            </SettingSection>
          </Box>
        )}

        {/* Tax & Inventory Tab */}
        {tabValue === 2 && (
          <Box>
            <SettingSection title="Tax Configuration">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={taxSettings.enableTax}
                        onChange={(e) => setTaxSettings({ ...taxSettings, enableTax: e.target.checked })}
                      />
                    }
                    label="Enable Tax Calculation"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="GST Percentage"
                    type="number"
                    value={taxSettings.gstPercentage}
                    onChange={(e) => setTaxSettings({ ...taxSettings, gstPercentage: parseFloat(e.target.value) || 0 })}
                    size="small"
                    inputProps={{ step: '0.01', min: '0' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Tax Method</InputLabel>
                    <Select
                      value={taxSettings.taxMethod}
                      label="Tax Method"
                      onChange={(e) => setTaxSettings({ ...taxSettings, taxMethod: e.target.value })}
                    >
                      <MenuItem value="inclusive">Inclusive</MenuItem>
                      <MenuItem value="exclusive">Exclusive</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={taxSettings.multipleGST}
                        onChange={(e) => setTaxSettings({ ...taxSettings, multipleGST: e.target.checked })}
                      />
                    }
                    label="Allow Multiple Tax Rates"
                  />
                </Grid>
              </Grid>
            </SettingSection>

            <SettingSection title="Inventory Settings">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={inventorySettings.enableLowStockAlert}
                        onChange={(e) => setInventorySettings({ ...inventorySettings, enableLowStockAlert: e.target.checked })}
                      />
                    }
                    label="Enable Low Stock Alerts"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Low Stock Threshold"
                    type="number"
                    value={inventorySettings.lowStockThreshold}
                    onChange={(e) => setInventorySettings({ ...inventorySettings, lowStockThreshold: parseInt(e.target.value) || 0 })}
                    size="small"
                    inputProps={{ min: '0' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={inventorySettings.enableExpiryTracking}
                        onChange={(e) => setInventorySettings({ ...inventorySettings, enableExpiryTracking: e.target.checked })}
                      />
                    }
                    label="Enable Expiry Tracking"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={inventorySettings.enableBarcodeTracking}
                        onChange={(e) => setInventorySettings({ ...inventorySettings, enableBarcodeTracking: e.target.checked })}
                      />
                    }
                    label="Enable Barcode Tracking"
                  />
                </Grid>
              </Grid>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={() => handleSave('tax-inventory')}
                disabled={saving}
                sx={{ mt: 2 }}
              >
                Save Tax & Inventory Settings
              </Button>
            </SettingSection>
          </Box>
        )}

        {/* Printer Tab */}
        {tabValue === 3 && (
          <Box>
            <SettingSection title="Printer Configuration">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Default Printer"
                    value={printerSettings.defaultPrinter}
                    onChange={(e) => setPrinterSettings({ ...printerSettings, defaultPrinter: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Receipt Format</InputLabel>
                    <Select
                      value={printerSettings.receiptFormat}
                      label="Receipt Format"
                      onChange={(e) => setPrinterSettings({ ...printerSettings, receiptFormat: e.target.value })}
                    >
                      <MenuItem value="thermal">Thermal (80mm)</MenuItem>
                      <MenuItem value="standard">Standard (A4)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Copies"
                    type="number"
                    value={printerSettings.copies}
                    onChange={(e) => setPrinterSettings({ ...printerSettings, copies: parseInt(e.target.value) || 1 })}
                    size="small"
                    inputProps={{ min: '1' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={printerSettings.autoClose}
                        onChange={(e) => setPrinterSettings({ ...printerSettings, autoClose: e.target.checked })}
                      />
                    }
                    label="Auto Close After Print"
                  />
                </Grid>
              </Grid>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={() => handleSave('printer')}
                disabled={saving}
                sx={{ mt: 2 }}
              >
                Save Printer Settings
              </Button>
            </SettingSection>
          </Box>
        )}

        {/* Cash Drawer Tab */}
        {tabValue === 4 && (
          <Box>
            <SettingSection title="Cash Drawer Configuration">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={cashDrawerSettings.enableCashDrawer}
                        onChange={(e) => setCashDrawerSettings({ ...cashDrawerSettings, enableCashDrawer: e.target.checked })}
                      />
                    }
                    label="Enable Cash Drawer"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small" disabled={!cashDrawerSettings.enableCashDrawer}>
                    <InputLabel>Brand</InputLabel>
                    <Select
                      value={cashDrawerSettings.brand}
                      label="Brand"
                      onChange={(e) => setCashDrawerSettings({ ...cashDrawerSettings, brand: e.target.value })}
                    >
                      <MenuItem value="generic">Generic</MenuItem>
                      <MenuItem value="star">Star Micronics</MenuItem>
                      <MenuItem value="epson">Epson</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small" disabled={!cashDrawerSettings.enableCashDrawer}>
                    <InputLabel>Connection Type</InputLabel>
                    <Select
                      value={cashDrawerSettings.connectionType}
                      label="Connection Type"
                      onChange={(e) => setCashDrawerSettings({ ...cashDrawerSettings, connectionType: e.target.value })}
                    >
                      <MenuItem value="usb">USB</MenuItem>
                      <MenuItem value="serial">Serial</MenuItem>
                      <MenuItem value="ethernet">Ethernet</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Port"
                    value={cashDrawerSettings.port}
                    onChange={(e) => setCashDrawerSettings({ ...cashDrawerSettings, port: e.target.value })}
                    size="small"
                    disabled={!cashDrawerSettings.enableCashDrawer}
                  />
                </Grid>
              </Grid>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={() => handleSave('cash-drawer')}
                disabled={saving}
                sx={{ mt: 2 }}
              >
                Save Cash Drawer Settings
              </Button>
            </SettingSection>
          </Box>
        )}

        {/* Localization Tab */}
        {tabValue === 5 && (
          <Box>
            <SettingSection title="Localization & Regional Settings">
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Currency</InputLabel>
                    <Select
                      value={localizationSettings.currency}
                      label="Currency"
                      onChange={(e) => setLocalizationSettings({ ...localizationSettings, currency: e.target.value })}
                    >
                      <MenuItem value="INR">INR (₹)</MenuItem>
                      <MenuItem value="USD">USD ($)</MenuItem>
                      <MenuItem value="EUR">EUR (€)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Date Format</InputLabel>
                    <Select
                      value={localizationSettings.dateFormat}
                      label="Date Format"
                      onChange={(e) => setLocalizationSettings({ ...localizationSettings, dateFormat: e.target.value })}
                    >
                      <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
                      <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
                      <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Time Format</InputLabel>
                    <Select
                      value={localizationSettings.timeFormat}
                      label="Time Format"
                      onChange={(e) => setLocalizationSettings({ ...localizationSettings, timeFormat: e.target.value })}
                    >
                      <MenuItem value="24h">24 Hour</MenuItem>
                      <MenuItem value="12h">12 Hour (AM/PM)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={localizationSettings.timezone}
                      label="Timezone"
                      onChange={(e) => setLocalizationSettings({ ...localizationSettings, timezone: e.target.value })}
                    >
                      <MenuItem value="Asia/Kolkata">Asia/Kolkata (IST)</MenuItem>
                      <MenuItem value="Asia/Kolkata">Asia/Kolkata (IST)</MenuItem>
                      <MenuItem value="UTC">UTC</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Language</InputLabel>
                    <Select
                      value={localizationSettings.language}
                      label="Language"
                      onChange={(e) => setLocalizationSettings({ ...localizationSettings, language: e.target.value })}
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="hi">Hindi</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Auto Logout (Minutes)"
                    type="number"
                    value={localizationSettings.autoLogoutMinutes}
                    onChange={(e) => setLocalizationSettings({ ...localizationSettings, autoLogoutMinutes: parseInt(e.target.value) || 15 })}
                    size="small"
                    inputProps={{ min: '5' }}
                  />
                </Grid>
              </Grid>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={() => handleSave('localization')}
                disabled={saving}
                sx={{ mt: 2 }}
              >
                Save Localization Settings
              </Button>
            </SettingSection>
          </Box>
        )}

        {/* Audit & Security Tab */}
        {tabValue === 6 && (
          <Box>
            <SettingSection title="Audit & Security">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={auditSettings.enableAuditLog}
                        onChange={(e) => setAuditSettings({ ...auditSettings, enableAuditLog: e.target.checked })}
                      />
                    }
                    label="Enable Audit Log"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={auditSettings.enableUserActivity}
                        onChange={(e) => setAuditSettings({ ...auditSettings, enableUserActivity: e.target.checked })}
                      />
                    }
                    label="Enable User Activity Tracking"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Log Retention (Days)"
                    type="number"
                    value={auditSettings.retentionDays}
                    onChange={(e) => setAuditSettings({ ...auditSettings, retentionDays: parseInt(e.target.value) || 90 })}
                    size="small"
                    inputProps={{ min: '30' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Approval Threshold (₹)"
                    type="number"
                    value={auditSettings.requireApprovalThreshold}
                    onChange={(e) => setAuditSettings({ ...auditSettings, requireApprovalThreshold: parseFloat(e.target.value) || 10000 })}
                    size="small"
                    inputProps={{ min: '0', step: '1000' }}
                  />
                </Grid>
              </Grid>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={() => handleSave('audit-security')}
                disabled={saving}
                sx={{ mt: 2 }}
              >
                Save Audit & Security Settings
              </Button>
            </SettingSection>
          </Box>
        )}

        {/* Barcode & Scale Tab */}
        {tabValue === 7 && (
          <Box>
            <SettingSection title="Scale Configuration">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={barcodeScaleSettings.enableScale}
                        onChange={(e) => setBarcodeScaleSettings({ ...barcodeScaleSettings, enableScale: e.target.checked })}
                      />
                    }
                    label="Enable Scale Integration"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small" disabled={!barcodeScaleSettings.enableScale}>
                    <InputLabel>Scale Brand</InputLabel>
                    <Select
                      value={barcodeScaleSettings.scaleBrand}
                      label="Scale Brand"
                      onChange={(e) => setBarcodeScaleSettings({ ...barcodeScaleSettings, scaleBrand: e.target.value })}
                    >
                      <MenuItem value="generic">Generic</MenuItem>
                      <MenuItem value="mettler">Mettler Toledo</MenuItem>
                      <MenuItem value="cas">CAS</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small" disabled={!barcodeScaleSettings.enableScale}>
                    <InputLabel>Connection Type</InputLabel>
                    <Select
                      value={barcodeScaleSettings.scaleConnectionType}
                      label="Connection Type"
                      onChange={(e) => setBarcodeScaleSettings({ ...barcodeScaleSettings, scaleConnectionType: e.target.value })}
                    >
                      <MenuItem value="usb">USB</MenuItem>
                      <MenuItem value="serial">Serial</MenuItem>
                      <MenuItem value="lan">Network (LAN)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Port"
                    value={barcodeScaleSettings.scalePort}
                    onChange={(e) => setBarcodeScaleSettings({ ...barcodeScaleSettings, scalePort: e.target.value })}
                    size="small"
                    disabled={!barcodeScaleSettings.enableScale}
                  />
                </Grid>
              </Grid>
            </SettingSection>

            <SettingSection title="Barcode Configuration">
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Barcode Prefix"
                    value={barcodeScaleSettings.barcodePrefix}
                    onChange={(e) => setBarcodeScaleSettings({ ...barcodeScaleSettings, barcodePrefix: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Barcode Format</InputLabel>
                    <Select
                      value={barcodeScaleSettings.barcodeFormat}
                      label="Barcode Format"
                      onChange={(e) => setBarcodeScaleSettings({ ...barcodeScaleSettings, barcodeFormat: e.target.value })}
                    >
                      <MenuItem value="CODE128">CODE128</MenuItem>
                      <MenuItem value="EAN13">EAN13</MenuItem>
                      <MenuItem value="UPC">UPC</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={() => handleSave('barcode-scale')}
                disabled={saving}
                sx={{ mt: 2 }}
              >
                Save Barcode & Scale Settings
              </Button>
            </SettingSection>
          </Box>
        )}
      </Card>
    </Layout>
  );
};

export default Settings;
