import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth endpoints
export const authAPI = {
  login: (email: string, password: string, tenantId: string) =>
    api.post('/auth/login', { email, password, tenantId }),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// Product endpoints
export const productAPI = {
  getAll: (search?: string, category?: string) =>
    api.get('/products', { params: { search, category } }),
  scanBarcode: (barcode: string) => api.get(`/products/scan/${barcode}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
};

// Bill endpoints
export const billAPI = {
  create: (data: any) => api.post('/bills', data),
  getAll: (startDate?: string, endDate?: string, outlet?: string) =>
    api.get('/bills', { params: { startDate, endDate, outlet } }),
  getById: (id: string) => api.get(`/bills/${id}`),
};

// Customer endpoints
export const customerAPI = {
  search: (query: string) => api.get(`/customers/search/${query}`),
  create: (data: any) => api.post('/customers', data),
  getById: (id: string) => api.get(`/customers/${id}`),
};

// Inventory endpoints
export const inventoryAPI = {
  getAll: (outlet?: string) => api.get('/inventory', { params: { outlet } }),
  getLowStock: (outlet: string) => api.get(`/inventory/low-stock/${outlet}`),
  adjust: (data: any) => api.post('/inventory/adjust', data),
};

export default api;
