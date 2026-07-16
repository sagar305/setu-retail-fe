import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useFeedback } from '../context/FeedbackContext';

const Categories = () => {
  const { toast, confirm } = useFeedback();
  const [categories, setCategories] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchCategories();
  }, [searchQuery]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError('');
      const params = searchQuery ? { search: searchQuery } : {};
      const response = await api.get('/categories', { params });
      const categoriesList = Array.isArray(response.data) ? response.data : (response.data.categories || []);
      setCategories(categoriesList);
    } catch (err) {
      setError('Failed to load categories');
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (category = null) => {
    setError('');
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
      });
    }
    setOpenForm(true);
  };

  const handleSaveCategory = async () => {
    try {
      if (!formData.name) {
        setError('Please fill in category name');
        return;
      }

      setSaving(true);
      setError('');

      if (editingCategory) {
        await api.put(`/categories/${editingCategory._id}`, formData);
      } else {
        await api.post('/categories', formData);
      }

      setOpenForm(false);
      await fetchCategories();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save category');
      console.error('Error saving category:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    const ok = await confirm({
      title: 'Delete category?',
      message: 'Products in this category will keep working but lose this grouping.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      setError('');
      await api.delete(`/categories/${categoryId}`);
      toast('Category deleted');
      await fetchCategories();
    } catch (err) {
      setError('Failed to delete category');
      console.error('Error deleting category:', err);
    }
  };

  if (loading && categories.length === 0) {
    return (
      <Layout title="Categories">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Categories">
      <Card sx={{ padding: '24px', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: '300px' }}>
            <TextField
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              fullWidth
              disabled={loading}
            />
          </Box>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => handleOpenForm()}
            disabled={loading}
          >
            Add Category
          </Button>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
      </Card>

      <Card sx={{ padding: '24px' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F3ED' }}>
              <TableCell sx={{ fontWeight: 700 }}>CATEGORY NAME</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>DESCRIPTION</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>PRODUCT COUNT</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">
                ACTIONS
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: '#9AA0C0' }}>
                  No categories found
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category._id} sx={{ '&:hover': { backgroundColor: '#F5F3ED' } }}>
                  <TableCell sx={{ fontWeight: 600 }}>{category.name}</TableCell>
                  <TableCell sx={{ color: '#64748b', fontSize: '14px' }}>
                    {category.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${category.productCount || 0} products`}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleOpenForm(category)}
                      sx={{ color: '#1B1F3B' }}
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleDeleteCategory(category._id)}
                      sx={{ color: '#C24A3D' }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              fullWidth
              label="Category Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              size="small"
              placeholder="e.g., Electronics, Groceries, Clothing"
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              size="small"
              multiline
              rows={3}
              placeholder="Optional category description"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveCategory} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : (editingCategory ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Categories;
