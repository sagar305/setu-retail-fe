import React, { useState, useEffect, useContext } from 'react';
import {
  Card,
  Typography,
  Box,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
} from '@mui/material';
import { Download } from 'lucide-react';
import Layout from '../components/Layout';
import { OutletContext } from '../context/OutletContext';
import api from '../services/api';

const SimpleBarChart = ({ data, height = 300 }) => {
  if (!data || data.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
          No data available
        </Typography>
      </Box>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.min(60, 100 / data.length);

  return (
    <Box sx={{ height, display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: 'center', p: 2 }}>
      {data.map((item, idx) => (
        <Box
          key={idx}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            minWidth: `${barWidth}%`,
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: `${(item.value / maxValue) * (height - 60)}px`,
              backgroundColor: '#F2A03D',
              borderRadius: '4px 4px 0 0',
            }}
          />
          <Typography variant="caption" sx={{ mt: 1, textAlign: 'center', fontSize: '10px' }}>
            {item.label}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '11px' }}>
            {item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

const Reports = () => {
  const { selectedOutlet } = useContext(OutletContext);
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState('thisMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const getDateRangeParams = () => {
    const today = new Date();
    let startDate, endDate;

    switch (dateRange) {
      case 'today':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'thisWeek':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisMonth':
        startDate = new Date(today);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisYear':
        startDate = new Date(today.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        return {};
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  useEffect(() => {
    fetchReportData();
  }, [reportType, dateRange, customStartDate, customEndDate, selectedOutlet]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const dateParams = getDateRangeParams();
      if (selectedOutlet) {
        dateParams.outletId = selectedOutlet._id;
      }

      let response;
      if (reportType === 'sales') {
        response = await api.get('/invoices/reports/sales', { params: dateParams });
        setReportData(response.data);
        // Create chart data from daily aggregates
        if (response.data.dailySummary) {
          setChartData(
            response.data.dailySummary.map((item) => ({
              label: new Date(item.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
              value: item.totalAmount || 0,
            }))
          );
        }
      } else if (reportType === 'inventory') {
        const inventoryParams = selectedOutlet ? { outletId: selectedOutlet._id } : {};
        response = await api.get('/inventory/stats', { params: inventoryParams });
        setReportData(response.data);
        setChartData([
          { label: 'In Stock', value: response.data.inStockCount || 0 },
          { label: 'Low Stock', value: response.data.lowStockCount || 0 },
          { label: 'Out of Stock', value: response.data.outOfStockCount || 0 },
        ]);
      } else if (reportType === 'customers') {
        const customerParams = selectedOutlet ? { outletId: selectedOutlet._id } : {};
        response = await api.get('/customers/stats/all', { params: customerParams });
        setReportData(response.data);
        setChartData([
          { label: 'Total Customers', value: response.data.totalCustomers || 0 },
          { label: 'Total Rewards', value: Math.round((response.data.totalRewardPoints || 0) / 100) },
        ]);
      } else if (reportType === 'topSelling') {
        response = await api.get('/invoices/reports/top-selling', { params: dateParams });
        setReportData(response.data);
        if (response.data.topProducts) {
          setChartData(
            response.data.topProducts.slice(0, 10).map((item) => ({
              label: item.productName?.substring(0, 10) || 'Product',
              value: item.quantity || 0,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      setReportData(null);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!reportData) return;

    let csvContent = '';

    if (reportType === 'sales') {
      csvContent = 'Date,Total Sales,Total Items,Total Tax,Total Discount\n';
      if (reportData.dailySummary) {
        reportData.dailySummary.forEach((item) => {
          csvContent += `${item.date},${item.totalAmount},${item.itemCount},${item.totalTax},${item.totalDiscount}\n`;
        });
      }
    } else if (reportType === 'topSelling') {
      csvContent = 'Product Name,Quantity Sold,Revenue\n';
      if (reportData.topProducts) {
        reportData.topProducts.forEach((item) => {
          csvContent += `${item.productName},${item.quantity},${item.revenue}\n`;
        });
      }
    }

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <Layout title="Reports">
      <Card sx={{ padding: '24px', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: '150px' }}>
            <InputLabel>Report Type</InputLabel>
            <Select value={reportType} label="Report Type" onChange={(e) => setReportType(e.target.value)}>
              <MenuItem value="sales">Sales Report</MenuItem>
              <MenuItem value="topSelling">Top Selling Products</MenuItem>
              <MenuItem value="inventory">Inventory Report</MenuItem>
              <MenuItem value="customers">Customer Report</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: '150px' }}>
            <InputLabel>Date Range</InputLabel>
            <Select value={dateRange} label="Date Range" onChange={(e) => setDateRange(e.target.value)}>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="yesterday">Yesterday</MenuItem>
              <MenuItem value="thisWeek">This Week</MenuItem>
              <MenuItem value="thisMonth">This Month</MenuItem>
              <MenuItem value="thisYear">This Year</MenuItem>
              <MenuItem value="custom">Custom Range</MenuItem>
            </Select>
          </FormControl>

          {dateRange === 'custom' && (
            <>
              <TextField
                label="Start Date"
                type="date"
                size="small"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End Date"
                type="date"
                size="small"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}

          <Button
            variant="contained"
            startIcon={<Download size={16} />}
            onClick={handleExport}
            disabled={!reportData}
          >
            Export CSV
          </Button>
        </Box>
      </Card>

      {reportData && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {reportType === 'sales' && reportData.totalSales !== undefined && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ padding: '24px' }}>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      TOTAL SALES
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#F2A03D' }}>
                      ₹{reportData.totalSales?.toFixed(0) || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ padding: '24px' }}>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      TOTAL ITEMS
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#1B1F3B' }}>
                      {reportData.totalItems || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ padding: '24px' }}>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      TOTAL TAX
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#2F8F5B' }}>
                      ₹{reportData.totalTax?.toFixed(0) || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ padding: '24px' }}>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      TOTAL DISCOUNT
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#C24A3D' }}>
                      ₹{reportData.totalDiscount?.toFixed(0) || 0}
                    </Typography>
                  </Card>
                </Grid>
              </>
            )}

            {reportType === 'topSelling' && reportData.totalRevenue !== undefined && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ padding: '24px' }}>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      TOTAL REVENUE
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#F2A03D' }}>
                      ₹{reportData.totalRevenue?.toFixed(0) || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ padding: '24px' }}>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      TOTAL UNITS
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#1B1F3B' }}>
                      {reportData.totalUnits || 0}
                    </Typography>
                  </Card>
                </Grid>
              </>
            )}

            {reportType === 'inventory' && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ padding: '24px' }}>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      TOTAL SKUS
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#1B1F3B' }}>
                      {reportData.totalSkus || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ padding: '24px' }}>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      STOCK VALUE
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#2F8F5B' }}>
                      ₹{reportData.totalStockValue?.toFixed(0) || 0}
                    </Typography>
                  </Card>
                </Grid>
              </>
            )}

            {reportType === 'customers' && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ padding: '24px' }}>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      TOTAL CUSTOMERS
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#1B1F3B' }}>
                      {reportData.totalCustomers || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ padding: '24px' }}>
                    <Typography variant="caption" sx={{ color: '#9AA0C0', fontWeight: 600 }}>
                      AVG PURCHASE
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, my: 1, color: '#F2A03D' }}>
                      ₹{reportData.averagePurchaseValue?.toFixed(0) || 0}
                    </Typography>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>

          <Card sx={{ padding: '24px', mb: 3 }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
              <Tab label="Chart" />
              <Tab label="Table" />
            </Tabs>

            {tabValue === 0 && <SimpleBarChart data={chartData} height={300} />}

            {tabValue === 1 && (
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
                    {reportType === 'sales' && (
                      <>
                        <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          AMOUNT
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          ITEMS
                        </TableCell>
                      </>
                    )}
                    {reportType === 'topSelling' && (
                      <>
                        <TableCell sx={{ fontWeight: 700 }}>PRODUCT</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          QUANTITY
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          REVENUE
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportType === 'sales' &&
                    reportData.dailySummary?.map((item, idx) => (
                      <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                        <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          ₹{(item.totalAmount || 0).toFixed(0)}
                        </TableCell>
                        <TableCell align="right">{item.itemCount || 0}</TableCell>
                      </TableRow>
                    ))}
                  {reportType === 'topSelling' &&
                    reportData.topProducts?.map((item, idx) => (
                      <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell align="right">{item.quantity || 0}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          ₹{(item.revenue || 0).toFixed(0)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}

      {!reportData && !loading && (
        <Card sx={{ padding: '24px', textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#9AA0C0' }}>
            Select filters to view report data
          </Typography>
        </Card>
      )}
    </Layout>
  );
};

export default Reports;
