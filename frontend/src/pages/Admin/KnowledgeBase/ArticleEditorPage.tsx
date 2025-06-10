import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Divider,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Autocomplete,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Save as SaveIcon,
  Preview as PreviewIcon,
  Send as SendIcon,
  ArrowBack as BackIcon,
  Category as CategoryIcon,
  Tag as TagIcon,
  Assignment as WorkflowIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import RichTextEditor from '../../../components/Common/RichTextEditor';
import api from '../../../services/api';

// Простан snackbar hook замена за notistack
const useSnackbar = () => ({
  enqueueSnackbar: (message: string, options?: { variant?: 'success' | 'error' | 'warning' | 'info' }) => {
    console.log(`${options?.variant?.toUpperCase() || 'INFO'}: ${message}`);
  }
});

interface KbCategory {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
}

interface KbTag {
  id: string;
  name: string;
  color?: string;
}

interface ArticleFormData {
  title: string;
  summary: string;
  content: string;
  categoryId: string;
  tags: string[];
  metaKeywords: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
}

interface WorkflowStep {
  label: string;
  description: string;
  status: 'completed' | 'active' | 'disabled';
}

const ArticleEditorPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = id !== 'new';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [availableTags, setAvailableTags] = useState<KbTag[]>([]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const [formData, setFormData] = useState<ArticleFormData>({
    title: '',
    summary: '',
    content: '',
    categoryId: '',
    tags: [],
    metaKeywords: '',
    status: 'draft'
  });

  const [formErrors, setFormErrors] = useState<Partial<ArticleFormData>>({});

  // Workflow кораци
  const getWorkflowSteps = (): WorkflowStep[] => {
    const steps: WorkflowStep[] = [
      {
        label: 'Нацрт',
        description: 'Креирање и едитовање чланка',
        status: 'completed'
      },
      {
        label: 'На прегледу',
        description: 'Чланак је послан на одобрење',
        status: formData.status === 'draft' ? 'disabled' : 
                 formData.status === 'review' ? 'active' : 'completed'
      },
      {
        label: 'Објављено',
        description: 'Чланак је одобрен и јаван',
        status: formData.status === 'published' ? 'completed' : 'disabled'
      }
    ];

    return steps;
  };

  // Учитај категорије
  const fetchCategories = async () => {
    try {
      const response = await api.get('/kb/categories');
      if (response.data.success) {
        setCategories(response.data.data);
      }
    } catch (error) {
      console.error('Грешка при учитавању категорија:', error);
    }
  };

  // Учитај тагове
  const fetchTags = async () => {
    try {
      // Симулирамо API позив за тагове
      const mockTags: KbTag[] = [
        { id: '1', name: 'Техничка подршка', color: '#1976d2' },
        { id: '2', name: 'Упутства', color: '#388e3c' },
        { id: '3', name: 'Решавање проблема', color: '#f57c00' },
        { id: '4', name: 'Корисничка подршка', color: '#d32f2f' }
      ];
      setAvailableTags(mockTags);
    } catch (error) {
      console.error('Грешка при учитавању тагова:', error);
    }
  };

  // Учитај чланак (ако је edit режим)
  const fetchArticle = async () => {
    if (!isEditMode) return;

    try {
      setLoading(true);
      const response = await api.get(`/kb/articles/${id}`);
      
      if (response.data.success) {
        const article = response.data.data;
        setFormData({
          title: article.title || '',
          summary: article.summary || '',
          content: article.content || '',
          categoryId: article.categoryId || '',
          tags: article.tags || [],
          metaKeywords: article.metaKeywords || '',
          status: article.status || 'draft'
        });
      }
    } catch (error: any) {
      console.error('Грешка при учитавању чланка:', error);
      enqueueSnackbar('Грешка при учитавању чланка', { variant: 'error' });
      navigate('/admin/kb/articles');
    } finally {
      setLoading(false);
    }
  };

  // Валидација форме
  const validateForm = (): boolean => {
    const errors: Partial<ArticleFormData> = {};

    if (!formData.title.trim()) {
      errors.title = 'Наслов чланка је обавезан';
    } else if (formData.title.length < 5) {
      errors.title = 'Наслов мора имати најмање 5 карактера';
    } else if (formData.title.length > 255) {
      errors.title = 'Наслов може имати највише 255 карактера';
    }

    if (!formData.content.trim() || formData.content === '<p><br></p>') {
      errors.content = 'Садржај чланка је обавезан';
    } else if (formData.content.length < 50) {
      errors.content = 'Садржај мора имати најмање 50 карактера';
    }

    if (formData.summary && formData.summary.length > 500) {
      errors.summary = 'Сажетак може имати највише 500 карактера';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Сачувај чланак
  const saveArticle = async (newStatus?: string) => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      
      const articleData = {
        ...formData,
        status: newStatus || formData.status,
        summary: formData.summary || undefined,
        categoryId: formData.categoryId || undefined,
        metaKeywords: formData.metaKeywords || undefined
      };

      let response;
      if (isEditMode) {
        response = await api.put(`/kb/articles/${id}`, articleData);
      } else {
        response = await api.post('/kb/articles', articleData);
      }

      if (response.data.success) {
        enqueueSnackbar(
          isEditMode ? 'Чланак је успешно ажуриран' : 'Чланак је успешно креиран',
          { variant: 'success' }
        );
        
        if (!isEditMode) {
          navigate(`/admin/kb/articles/${response.data.data.id}/edit`);
        } else if (newStatus) {
          setFormData(prev => ({ ...prev, status: newStatus as any }));
        }
      }
    } catch (error: any) {
      console.error('Грешка при чувању чланка:', error);
      const message = error.response?.data?.message || 'Грешка при чувању чланка';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Промени статус чланка преко workflow-а
  const changeStatus = async (newStatus: string) => {
    if (!isEditMode) {
      await saveArticle(newStatus);
      return;
    }

    try {
      await api.put(`/kb/articles/${id}/workflow/status`, { status: newStatus });
      setFormData(prev => ({ ...prev, status: newStatus as any }));
      enqueueSnackbar('Статус чланка је успешно промењен', { variant: 'success' });
    } catch (error: any) {
      console.error('Грешка при промени статуса:', error);
      const message = error.response?.data?.message || 'Грешка при промени статуса';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchTags();
    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Учитавам чланак...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => navigate('/admin/kb/articles')}
          >
            Назад
          </Button>
          <Typography variant="h4">
            {isEditMode ? 'Уреди чланак' : 'Нови чланак'}
          </Typography>
        </Box>
        
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="outlined"
            startIcon={<PreviewIcon />}
            onClick={() => setPreviewDialogOpen(true)}
            disabled={!formData.title && !formData.content}
          >
            Преглед
          </Button>
          
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={() => saveArticle()}
            disabled={saving}
          >
            {saving ? 'Чувам...' : 'Сачувај'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Основне информације */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardHeader title="Основне информације" />
            <CardContent>
              <Box display="flex" flexDirection="column" gap={3}>
                <TextField
                  label="Наслов чланка"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  error={!!formErrors.title}
                  helperText={formErrors.title}
                  fullWidth
                  required
                />

                <TextField
                  label="Кратки сажетак"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  error={!!formErrors.summary}
                  helperText={formErrors.summary || 'Опциони кратки опис чланка за приказ у листама'}
                  fullWidth
                  multiline
                  rows={2}
                />

                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Садржај чланка *
                  </Typography>
                  <RichTextEditor
                    value={formData.content}
                    onChange={(content) => setFormData({ ...formData, content })}
                    placeholder="Почните писање садржаја чланка..."
                    error={formErrors.content}
                    helperText={formErrors.content}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Категорије и тагови */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 3 }}>
            <CardHeader 
              title="Категорија и тагови"
              avatar={<CategoryIcon />}
            />
            <CardContent>
              <Box display="flex" flexDirection="column" gap={2}>
                <FormControl fullWidth>
                  <InputLabel>Категорија</InputLabel>
                  <Select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    label="Категорија"
                  >
                    <MenuItem value="">
                      <em>Без категорије</em>
                    </MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {category.icon && (
                            <span style={{ fontSize: '1rem' }}>{category.icon}</span>
                          )}
                          {category.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Autocomplete
                  multiple
                  options={availableTags.map(tag => tag.name)}
                  value={formData.tags}
                  onChange={(event, newValue) => setFormData({ ...formData, tags: newValue })}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const tag = availableTags.find(t => t.name === option);
                      return (
                        <Chip
                          variant="outlined"
                          label={option}
                          {...getTagProps({ index })}
                          style={{ backgroundColor: tag?.color, color: 'white' }}
                        />
                      );
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Тагови"
                      placeholder="Изабери или укуцај тагове"
                    />
                  )}
                  freeSolo
                />

                <TextField
                  label="Кључне речи за претрагу"
                  value={formData.metaKeywords}
                  onChange={(e) => setFormData({ ...formData, metaKeywords: e.target.value })}
                  fullWidth
                  helperText="Опционе кључне речи раздвојене запетом"
                  placeholder="npr: подршка, упутство, решење"
                />
              </Box>
            </CardContent>
          </Card>

          {/* Workflow статус */}
          <Card>
            <CardHeader 
              title="Статус чланка"
              avatar={<WorkflowIcon />}
            />
            <CardContent>
              <Stepper activeStep={
                formData.status === 'draft' ? 0 :
                formData.status === 'review' ? 1 :
                formData.status === 'published' ? 2 : 0
              } orientation="vertical">
                {getWorkflowSteps().map((step, index) => (
                  <Step key={index}>
                    <StepLabel>{step.label}</StepLabel>
                    <StepContent>
                      <Typography variant="body2" color="text.secondary">
                        {step.description}
                      </Typography>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>

              <Box mt={2} display="flex" flexDirection="column" gap={1}>
                {formData.status === 'draft' && (
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    onClick={() => changeStatus('review')}
                    fullWidth
                  >
                    Пошаљи на преглед
                  </Button>
                )}

                {formData.status === 'review' && (
                  <>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => changeStatus('published')}
                      fullWidth
                    >
                      Објави чланак
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => changeStatus('rejected')}
                      fullWidth
                    >
                      Одбаци чланак
                    </Button>
                  </>
                )}

                {formData.status === 'published' && (
                  <Button
                    variant="outlined"
                    onClick={() => changeStatus('archived')}
                    fullWidth
                  >
                    Архивирај чланак
                  </Button>
                )}

                {formData.status === 'rejected' && (
                  <Button
                    variant="outlined"
                    onClick={() => changeStatus('draft')}
                    fullWidth
                  >
                    Врати у нацрт
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Преглед чланка</DialogTitle>
        <DialogContent>
          <Box>
            <Typography variant="h4" gutterBottom>
              {formData.title || 'Без наслова'}
            </Typography>
            
            {formData.summary && (
              <Typography variant="subtitle1" color="text.secondary" paragraph>
                {formData.summary}
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />

            <Box
              dangerouslySetInnerHTML={{ __html: formData.content || '<p>Нема садржаја</p>' }}
              sx={{
                '& img': { maxWidth: '100%', height: 'auto' },
                '& blockquote': { 
                  borderLeft: '4px solid #ccc', 
                  paddingLeft: 2, 
                  marginLeft: 0,
                  fontStyle: 'italic'
                }
              }}
            />

            {formData.tags.length > 0 && (
              <Box mt={3}>
                <Typography variant="subtitle2" gutterBottom>Тагови:</Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {formData.tags.map((tag, index) => {
                    const tagInfo = availableTags.find(t => t.name === tag);
                    return (
                      <Chip 
                        key={index} 
                        label={tag} 
                        size="small"
                        style={{ backgroundColor: tagInfo?.color, color: 'white' }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>
            Затвори
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArticleEditorPage; 