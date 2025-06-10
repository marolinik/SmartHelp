import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Autocomplete
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AICategorization from '../../components/Tickets/AICategorization';
import aiCategorizationService, { AICategory } from '../../services/aiCategorizationService';

// Types
interface Category {
  id: string;
  name: string;
  description?: string;
}

interface PriorityOption {
  value: string;
  label: string;
}

interface CreateTicketData {
  title: string;
  description: string;
  categoryId: string;
  priority: string;
  tags: string[];
}

const CreateTicketPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // State
  const [formData, setFormData] = useState<CreateTicketData>({
    title: '',
    description: '',
    categoryId: '',
    priority: 'medium',
    tags: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Options
  const [categories, setCategories] = useState<Category[]>([]);
  const [priorities, setPriorities] = useState<PriorityOption[]>([]);
  const [aiCategories, setAiCategories] = useState<AICategory[]>([]);
  
  // Validation
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // API calls
  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tickets/categories', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCategories(data.data);
        }
      }
    } catch (err) {
      console.error('Грешка при учитавању категорија:', err);
    }
  };

  const fetchPriorities = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tickets/workflow/priorities', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPriorities(data.data);
        }
      }
    } catch (err) {
      console.error('Грешка при учитавању приоритета:', err);
    }
  };

  const fetchAiCategories = async () => {
    try {
      const result = await aiCategorizationService.getCategories();
      if (result.success && result.categories) {
        setAiCategories(result.categories);
      }
    } catch (err) {
      console.error('Грешка при учитавању AI категорија:', err);
    }
  };

  const createTicket = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Тикет је успешно креиран!');
        setTimeout(() => {
          navigate('/tickets');
        }, 2000);
      } else {
        throw new Error(data.message || 'Грешка при креирању тикета');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Непозната грешка');
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchCategories();
    fetchPriorities();
    fetchAiCategories();
  }, []);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Наслов је обавезан';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Наслов мора имати најмање 5 карактера';
    } else if (formData.title.length > 255) {
      newErrors.title = 'Наслов може имати максимално 255 карактера';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Опис је обавезан';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Опис мора имати најмање 10 карактера';
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Категорија је обавезна';
    }

    if (!formData.priority) {
      newErrors.priority = 'Приоритет је обавезан';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // AI Handlers
  const handleAiSuggestionAccept = (categoryKey: string) => {
    // Map AI category key to regular category ID
    const mappedCategory = categories.find(cat => 
      cat.name.toLowerCase().includes(categoryKey.toLowerCase()) ||
      aiCategories.find(aiCat => aiCat.key === categoryKey)?.displayName.toLowerCase() === cat.name.toLowerCase()
    );
    
    if (mappedCategory) {
      handleInputChange('categoryId', mappedCategory.id);
    }
  };

  const handleAiKeywordsAccept = (keywords: string[]) => {
    // Add suggested keywords to tags
    const newTags = [...new Set([...formData.tags, ...keywords])]; // Remove duplicates
    handleInputChange('tags', newTags);
  };

  // Handlers
  const handleInputChange = (field: keyof CreateTicketData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      createTicket();
    }
  };

  const handleCancel = () => {
    navigate('/tickets');
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
      critical: '#9C27B0'
    };
    return colors[priority as keyof typeof colors] || '#757575';
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Нови тикет
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Title */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Наслов тикета *"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                error={!!errors.title}
                helperText={errors.title}
                placeholder="Кратак и јасан опис проблема"
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Опис проблема *"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                error={!!errors.description}
                helperText={errors.description}
                placeholder="Детаљан опис проблема, корака за репродукцију, и очекиваног резултата"
              />
            </Grid>

            {/* AI Categorization */}
            <Grid item xs={12}>
              <AICategorization
                title={formData.title}
                description={formData.description}
                currentCategoryId={formData.categoryId}
                onSuggestionAccept={handleAiSuggestionAccept}
                onKeywordsAccept={handleAiKeywordsAccept}
                disabled={loading}
                showDetailedView={false}
              />
            </Grid>

            {/* Category and Priority */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!errors.categoryId}>
                <InputLabel>Категорија *</InputLabel>
                <Select
                  value={formData.categoryId}
                  label="Категорија *"
                  onChange={(e) => handleInputChange('categoryId', e.target.value)}
                >
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
                {errors.categoryId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                    {errors.categoryId}
                  </Typography>
                )}
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!errors.priority}>
                <InputLabel>Приоритет *</InputLabel>
                <Select
                  value={formData.priority}
                  label="Приоритет *"
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  renderValue={(value) => {
                    const priority = priorities.find(p => p.value === value);
                    return (
                      <Box display="flex" alignItems="center">
                        <Chip
                          label={priority?.label || value}
                          size="small"
                          variant="outlined"
                          sx={{
                            borderColor: getPriorityColor(value),
                            color: getPriorityColor(value),
                          }}
                        />
                      </Box>
                    );
                  }}
                >
                  {priorities.map((priority) => (
                    <MenuItem key={priority.value} value={priority.value}>
                      <Chip
                        label={priority.label}
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: getPriorityColor(priority.value),
                          color: getPriorityColor(priority.value),
                        }}
                      />
                    </MenuItem>
                  ))}
                </Select>
                {errors.priority && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                    {errors.priority}
                  </Typography>
                )}
              </FormControl>
            </Grid>

            {/* Tags */}
            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={formData.tags}
                onChange={(event, newValue) => {
                  handleInputChange('tags', newValue);
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={index}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Тагови (опционо)"
                    placeholder="Додајте тагове за лакше претраживање"
                    helperText="Притисните Enter да додате таг"
                  />
                )}
              />
            </Grid>

            {/* Selected Category Info */}
            {formData.categoryId && (
              <Grid item xs={12}>
                {(() => {
                  const selectedCategory = categories.find(c => c.id === formData.categoryId);
                  if (selectedCategory?.description) {
                    return (
                      <Alert severity="info">
                        <Typography variant="body2">
                          <strong>{selectedCategory.name}:</strong> {selectedCategory.description}
                        </Typography>
                      </Alert>
                    );
                  }
                  return null;
                })()}
              </Grid>
            )}

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Откажи
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                  disabled={loading}
                >
                  {loading ? 'Креирање...' : 'Креирај тикет'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default CreateTicketPage; 