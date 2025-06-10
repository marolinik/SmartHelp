import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Collapse,
  Tooltip,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Category as CategoryIcon,
  Description as DescriptionIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import api from '../../../services/api';

// Простан snackbar hook замена за notistack
const useSnackbar = () => ({
  enqueueSnackbar: (message: string, options?: { variant?: 'success' | 'error' | 'warning' | 'info' }) => {
    console.log(`${options?.variant?.toUpperCase() || 'INFO'}: ${message}`);
    // У продукцији би ово требало заменити правим toast системом
  }
});

interface KbCategory {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  children?: KbCategory[];
  articleCount?: number;
}

interface CategoryFormData {
  name: string;
  description: string;
  parentId: string;
  icon: string;
  displayOrder: number;
  isActive: boolean;
}

const CategoryManagementPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<KbCategory | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<KbCategory | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    parentId: '',
    icon: '',
    displayOrder: 0,
    isActive: true
  });

  const [formErrors, setFormErrors] = useState<Partial<CategoryFormData>>({});

  // Учитај категорије
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/kb/categories');
      
      if (response.data.success) {
        setCategories(buildCategoryTree(response.data.data));
      }
    } catch (error: any) {
      console.error('Грешка при учитавању категорија:', error);
      enqueueSnackbar('Грешка при учитавању категорија', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Изгради хијерархију категорија
  const buildCategoryTree = (flatCategories: KbCategory[]): KbCategory[] => {
    const categoryMap = new Map<string, KbCategory>();
    const rootCategories: KbCategory[] = [];

    // Прво креирај мапу свих категорија
    flatCategories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // Затим изгради хијерархију
    flatCategories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id)!;
      
      if (category.parentId && categoryMap.has(category.parentId)) {
        const parent = categoryMap.get(category.parentId)!;
        parent.children!.push(categoryWithChildren);
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    // Сортирај по displayOrder
    const sortCategories = (cats: KbCategory[]) => {
      cats.sort((a, b) => a.displayOrder - b.displayOrder);
      cats.forEach(cat => {
        if (cat.children && cat.children.length > 0) {
          sortCategories(cat.children);
        }
      });
    };

    sortCategories(rootCategories);
    return rootCategories;
  };

  // Toggle expanded state
  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedNodes(newExpanded);
  };

  // Отвори dialog за додавање/едитовање
  const openDialog = (category?: KbCategory, parentId?: string) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        parentId: category.parentId || '',
        icon: category.icon || '',
        displayOrder: category.displayOrder,
        isActive: category.isActive
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
        parentId: parentId || '',
        icon: '',
        displayOrder: 0,
        isActive: true
      });
    }
    setFormErrors({});
    setDialogOpen(true);
  };

  // Затвори dialog
  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      parentId: '',
      icon: '',
      displayOrder: 0,
      isActive: true
    });
    setFormErrors({});
  };

  // Валидација форме
  const validateForm = (): boolean => {
    const errors: Partial<CategoryFormData> = {};

    if (!formData.name.trim()) {
      errors.name = 'Назив категорије је обавезан';
    } else if (formData.name.length < 2) {
      errors.name = 'Назив мора имати најмање 2 карактера';
    } else if (formData.name.length > 100) {
      errors.name = 'Назив може имати највише 100 карактера';
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = 'Опис може имати највише 500 карактера';
    }

    if (formData.displayOrder < 0) {
      errors.displayOrder = 'Редослед мора бити позитиван број';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Сачувај категорију
  const saveCategory = async () => {
    if (!validateForm()) return;

    try {
      const categoryData = {
        ...formData,
        parentId: formData.parentId || undefined
      };

      if (editingCategory) {
        // Ажурирај постојећу категорију
        await api.put(`/kb/categories/${editingCategory.id}`, categoryData);
        enqueueSnackbar('Категорија је успешно ажурирана', { variant: 'success' });
      } else {
        // Креирај нову категорију
        await api.post('/kb/categories', categoryData);
        enqueueSnackbar('Категорија је успешно креирана', { variant: 'success' });
      }

      closeDialog();
      fetchCategories();
    } catch (error: any) {
      console.error('Грешка при чувању категорије:', error);
      const message = error.response?.data?.message || 'Грешка при чувању категорије';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // Отвори dialog за брисање
  const openDeleteDialog = (category: KbCategory) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  // Обриши категорију
  const deleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      await api.delete(`/kb/categories/${categoryToDelete.id}`);
      enqueueSnackbar('Категорија је успешно обрисана', { variant: 'success' });
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      fetchCategories();
    } catch (error: any) {
      console.error('Грешка при брисању категорије:', error);
      const message = error.response?.data?.message || 'Грешка при брисању категорије';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // Рендеруј категорију у листи
  const renderCategoryItem = (category: KbCategory, level: number = 0): React.ReactNode[] => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedNodes.has(category.id);
    
    const items: React.ReactNode[] = [
      <ListItem
        key={category.id}
        sx={{ 
          pl: 2 + level * 3,
          borderLeft: level > 0 ? '1px solid #e0e0e0' : 'none',
          '&:hover': { backgroundColor: 'action.hover' }
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          {hasChildren ? (
            <IconButton
              size="small"
              onClick={() => toggleExpanded(category.id)}
            >
              {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
            </IconButton>
          ) : (
            <Box width={40} />
          )}
        </ListItemIcon>
        
        <ListItemIcon sx={{ minWidth: 40 }}>
          {category.icon ? (
            <span style={{ fontSize: '1.2em' }}>{category.icon}</span>
          ) : (
            <CategoryIcon color="action" />
          )}
        </ListItemIcon>
        
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography 
                variant="body1" 
                sx={{ fontWeight: hasChildren ? 'bold' : 'normal' }}
              >
                {category.name}
              </Typography>
              {!category.isActive && (
                <Chip label="Неактивна" size="small" color="default" />
              )}
              {category.articleCount !== undefined && (
                <Chip 
                  label={`${category.articleCount} чланака`} 
                  size="small" 
                  variant="outlined" 
                />
              )}
            </Box>
          }
          secondary={category.description}
        />
        
        <ListItemSecondaryAction>
          <Box display="flex" alignItems="center" gap={0.5}>
            <Tooltip title="Додај подкатегорију">
              <IconButton
                size="small"
                onClick={() => openDialog(undefined, category.id)}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Уреди категорију">
              <IconButton
                size="small"
                onClick={() => openDialog(category)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Обриши категорију">
              <IconButton
                size="small"
                onClick={() => openDeleteDialog(category)}
                color="error"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    ];

    // Додај подкатегорије ако су проширене
    if (hasChildren && isExpanded) {
      category.children!.forEach(child => {
        items.push(...renderCategoryItem(child, level + 1));
      });
    }

    return items;
  };

  // Добиј све категорије као flat листу за parent dropdown
  const getFlatCategoryList = (cats: KbCategory[], level = 0): Array<{id: string, name: string, level: number}> => {
    let result: Array<{id: string, name: string, level: number}> = [];
    
    cats.forEach(cat => {
      result.push({
        id: cat.id,
        name: cat.name,
        level
      });
      
      if (cat.children && cat.children.length > 0) {
        result = result.concat(getFlatCategoryList(cat.children, level + 1));
      }
    });
    
    return result;
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Учитавам категорије...
        </Typography>
      </Box>
    );
  }

  const flatCategories = getFlatCategoryList(categories);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <CategoryIcon />
          Управљање категоријама
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openDialog()}
        >
          Додај категорију
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader 
              title="Хијерархија категорија"
              subheader="Организујте категорије у логичку структуру"
            />
            <CardContent sx={{ p: 0 }}>
              {categories.length === 0 ? (
                <Box p={3}>
                  <Alert severity="info">
                    Нема креираних категорија. Додајте прву категорију да почнете.
                  </Alert>
                </Box>
              ) : (
                <List sx={{ width: '100%' }}>
                  {categories.map(category => renderCategoryItem(category))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog за додавање/едитовање категорије */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory ? 'Уреди категорију' : 'Додај нову категорију'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Назив категорије"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              fullWidth
              required
            />
            
            <TextField
              label="Опис"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              error={!!formErrors.description}
              helperText={formErrors.description}
              fullWidth
              multiline
              rows={3}
            />

            <FormControl fullWidth>
              <InputLabel>Родитељска категорија</InputLabel>
              <Select
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                label="Родитељска категорија"
              >
                <MenuItem value="">
                  <em>Нема (главна категорија)</em>
                </MenuItem>
                {flatCategories
                  .filter(cat => !editingCategory || cat.id !== editingCategory.id)
                  .map(cat => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {'—'.repeat(cat.level)} {cat.name}
                    </MenuItem>
                  ))
                }
              </Select>
            </FormControl>

            <TextField
              label="Икона (emoji или текст)"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              fullWidth
              placeholder="📁"
            />

            <TextField
              label="Редослед приказа"
              type="number"
              value={formData.displayOrder.toString()}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
              error={!!formErrors.displayOrder}
              helperText={formErrors.displayOrder}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Статус</InputLabel>
              <Select
                value={formData.isActive ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                label="Статус"
              >
                <MenuItem value="true">Активна</MenuItem>
                <MenuItem value="false">Неактивна</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>
            Откажи
          </Button>
          <Button onClick={saveCategory} variant="contained">
            {editingCategory ? 'Ажурирај' : 'Креирај'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog за потврду брисања */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Потврди брисање</DialogTitle>
        <DialogContent>
          <Typography>
            Да ли сте сигурни да желите да обришете категорију "{categoryToDelete?.name}"?
          </Typography>
          {categoryToDelete?.children && categoryToDelete.children.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Ова категорија има подкатегорије које ће такође бити обрисане.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Откажи
          </Button>
          <Button onClick={deleteCategory} color="error" variant="contained">
            Обриши
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CategoryManagementPage; 