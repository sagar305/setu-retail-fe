import React, { useState } from 'react';
import {
  Card, Typography, Box, TextField, Button, Tabs, Tab, Grid, Switch, FormControlLabel, Select, MenuItem, FormControl, InputLabel, Divider
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

  const [taxSettings, setTaxSettings] = useState({
    gstPercentage: 18,
    enableTax: true,
    taxMethod: 'inclusive',
  });

  const [printerSettings, setPrinterSettings] = useState({
    defaultPrinter: '',
    receiptFormat: 'thermal',
    paperSize: 'A4',
    autoClose: true,
  });

  const [scaleSettings, setScaleSettings] = useState({
    enableScale: false,
    brand: 'generic',
    connectionType: 'usb',
    port: 'COM1',
  });

  const handleSaveBusinessSettings = async () => {
    try {
      setSaving(true);
      // await api.put('/settings/business', businessSettings);
      alert('Business settings saved!');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Settings">
      <Card sx={{ padding: '24px' }}>
        <Tabs value={tabValue} onChange={(e, nv) => setTabValue(nv)} sx={{ mb: 3 }}>
          <Tab label="Business" />
          <Tab label="Tax" />
          <Tab label="Printer" />
          <Tab label="Scale" />
          <Tab label="Notifications" />
        </Tabs>

        {tabValue === 0 && (
          <Box>
            <SettingSection title="Business Information">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth label="Business Name" value={businessSettings.businessName} onChange={(e) => setBusinessSettings({ ...businessSettings, businessName: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Registration #" value={businessSettings.registrationNumber} onChange={(e) => setBusinessSettings({ ...businessSettings, registrationNumber: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="GST #" value={businessSettings.gstNumber} onChange={(e) => setBusinessSettings({ ...businessSettings, gstNumber: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Email" type="email" value={businessSettings.email} onChange={(e) => setBusinessSettings({ ...businessSettings, email: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Phone" value={businessSettings.phone} onChange={(e) => setBusinessSettings({ ...businessSettings, phone: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Address" multiline rows={2} value={businessSettings.address} onChange={(e) => setBusinessSettings({ ...businessSettings, address: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="City" value={businessSettings.city} onChange={(e) => setBusinessSettings({ ...businessSettings, city: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="State" value={businessSettings.state} onChange={(e) => setBusinessSettings({ ...businessSettings, state: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Pincode" value={businessSettings.pincode} onChange={(e) => setBusinessSettings({ ...businessSettings, pincode: e.target.value })} />
                </Grid>
              </Grid>
              <Button variant="contained" startIcon={<Save size={16} />} onClick={handleSaveBusinessSettings} disabled={saving} sx={{ mt: 2 }}>
                Save Settings
              </Button>
            </SettingSection>
          </Box>
        )}

        {tabValue === 1 && (
          <Box>
            <SettingSection title="Tax Configuration">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel control={<Switch checked={taxSettings.enableTax} onChange={(e) => setTaxSettings({ ...taxSettings, enableTax: e.target.checked })} />} label="Enable Tax Calculation" />
                <TextField label="GST Percentage" type="number" value={taxSettings.gstPercentage} onChange={(e) => setTaxSettings({ ...taxSettings, gstPercentage: parseFloat(e.target.value) })} inputProps={{ step: 0.01 }} />
                <FormControl>
                  <InputLabel>Tax Method</InputLabel>
                  <Select value={taxSettings.taxMethod} label="Tax Method" onChange={(e) => setTaxSettings({ ...taxSettings, taxMethod: e.target.value })}>
                    <MenuItem value="inclusive">Inclusive</MenuItem>
                    <MenuItem value="exclusive">Exclusive</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Button variant="contained" sx={{ mt: 2 }} startIcon={<Save size={16} />}>Save</Button>
            </SettingSection>
          </Box>
        )}

        {tabValue === 2 && (
          <Box>
            <SettingSection title="Printer Configuration">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="Default Printer" value={printerSettings.defaultPrinter} onChange={(e) => setPrinterSettings({ ...printerSettings, defaultPrinter: e.target.value })} />
                <FormControl>
                  <InputLabel>Receipt Format</InputLabel>
                  <Select value={printerSettings.receiptFormat} label="Receipt Format" onChange={(e) => setPrinterSettings({ ...printerSettings, receiptFormat: e.target.value })}>
                    <MenuItem value="thermal">Thermal (80mm)</MenuItem>
                    <MenuItem value="standard">Standard (A4)</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel control={<Switch checked={printerSettings.autoClose} onChange={(e) => setPrinterSettings({ ...printerSettings, autoClose: e.target.checked })} />} label="Auto Close After Print" />
              </Box>
              <Button variant="contained" sx={{ mt: 2 }} startIcon={<Save size={16} />}>Save</Button>
            </SettingSection>
          </Box>
        )}

        {tabValue === 3 && (
          <Box>
            <SettingSection title="Scale Integration">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel control={<Switch checked={scaleSettings.enableScale} onChange={(e) => setScaleSettings({ ...scaleSettings, enableScale: e.target.checked })} />} label="Enable Scale Integration" />
                <FormControl>
                  <InputLabel>Scale Brand</InputLabel>
                  <Select value={scaleSettings.brand} label="Scale Brand" onChange={(e) => setScaleSettings({ ...scaleSettings, brand: e.target.value })}>
                    <MenuItem value="generic">Generic</MenuItem>
                    <MenuItem value="mettler">Mettler Toledo</MenuItem>
                    <MenuItem value="cas">CAS</MenuItem>
                  </Select>
                </FormControl>
                <FormControl>
                  <InputLabel>Connection Type</InputLabel>
                  <Select value={scaleSettings.connectionType} label="Connection Type" onChange={(e) => setScaleSettings({ ...scaleSettings, connectionType: e.target.value })}>
                    <MenuItem value="usb">USB</MenuItem>
                    <MenuItem value="serial">Serial</MenuItem>
                    <MenuItem value="lan">Network (LAN)</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Port" value={scaleSettings.port} onChange={(e) => setScaleSettings({ ...scaleSettings, port: e.target.value })} />
              </Box>
              <Button variant="contained" sx={{ mt: 2 }} startIcon={<Save size={16} />}>Save</Button>
            </SettingSection>
          </Box>
        )}

        {tabValue === 4 && (
          <Box>
            <SettingSection title="Notification Preferences">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel control={<Switch defaultChecked />} label="Email Notifications" />
                <FormControlLabel control={<Switch defaultChecked />} label="Low Stock Alerts" />
                <FormControlLabel control={<Switch defaultChecked />} label="Expiry Alerts" />
                <FormControlLabel control={<Switch />} label="Order Confirmations" />
              </Box>
              <Button variant="contained" sx={{ mt: 2 }} startIcon={<Save size={16} />}>Save</Button>
            </SettingSection>
          </Box>
        )}
      </Card>
    </Layout>
  );
};

export default Settings;
