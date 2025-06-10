import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Typography,
  Chip,
  Box,
  Alert,
  Divider,
  FormGroup,
  FormLabel,
  RadioGroup,
  Radio,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  Preview as PreviewIcon,
  Code as CodeIcon,
  Description as TemplateIcon
} from '@mui/icons-material';

interface ReportTemplate {
  id?: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  status: 'active' | 'draft' | 'archived';
  queryDefinition: {
    metrics: string[];
    dimensions: string[];
    filters: Record<string, any>;
    dateRange: string;
  };
  layout: {
    type: 'table' | 'chart' | 'mixed';
    chartType?: 'line' | 'bar' | 'pie' | 'area';
    columns?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  formatting: {
    numberFormat: 'sr' | 'en';
    dateFormat: string;
    showTotals: boolean;
    showPercentages: boolean;
  };
}

interface TemplateEditDialogProps {
  open: boolean;
  template?: ReportTemplate | null;
  onClose: () => void;
  onSave: (template: ReportTemplate) => void;
}

const TemplateEditDialog: React.FC<TemplateEditDialogProps> = ({
  open,
  template,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<ReportTemplate>({
    name: '',
    description: '',
    category: '',
    isPublic: true,
    status: 'draft',
    queryDefinition: {
      metrics: [],
      dimensions: [],
      filters: {},
      dateRange: 'last_30_days'
    },
    layout: {
      type: 'table',
      columns: [],
      sortBy: '',
      sortOrder: 'desc'
    },
    formatting: {
      numberFormat: 'sr',
      dateFormat: 'dd.MM.yyyy',
      showTotals: true,
      showPercentages: false
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData(template);
    } else {
      // Reset form for new template
      setFormData({
        name: '',
        description: '',
        category: '',
        isPublic: true,
        status: 'draft',
        queryDefinition: {
          metrics: [],
          dimensions: [],
          filters: {},
          dateRange: 'last_30_days'
        },
        layout: {
          type: 'table',
          columns: [],
          sortBy: '',
          sortOrder: 'desc'
        },
        formatting: {
          numberFormat: 'sr',
          dateFormat: 'dd.MM.yyyy',
          showTotals: true,
          showPercentages: false
        }
      });
    }
    setErrors({});
  }, [template, open]);

  const availableCategories = [
    'Тикети',
    'SLA',
    'Корисници',
    'Систем',
    'Перформансе',
    'Безбедност',
    'Финансије'
  ];

  const availableMetrics = [
    'укупан_број_тикета',
    'решени_тикети',
    'просечно_време_решавања',
    'sla_усаглашеност',
    'задовољство_корисника',
    'број_ескалација',
    'тикети_по_приоритету',
    'активни_корисници',
    'нови_корисници'
  ];

  const availableDimensions = [
    'датум',
    'категорија',
    'приоритет',
    'статус',
    'корисник',
    'одељење',
    'сла_политика',
    'тип_тикета'
  ];

  const dateRangeOptions = [
    { value: 'today', label: 'Данас' },
    { value: 'yesterday', label: 'Јуче' },
    { value: 'last_7_days', label: 'Последњих 7 дана' },
    { value: 'last_30_days', label: 'Последњих 30 дана' },
    { value: 'last_90_days', label: 'Последњих 90 дана' },
    { value: 'this_month', label: 'Овај месец' },
    { value: 'last_month', label: 'Прошли месец' },
    { value: 'this_year', label: 'Ова година' },
    { value: 'custom', label: 'Прилагођени период' }
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleNestedChange = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof ReportTemplate],
        [field]: value
      }
    }));
  };

  const handleMetricsChange = (metric: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      queryDefinition: {
        ...prev.queryDefinition,
        metrics: checked 
          ? [...prev.queryDefinition.metrics, metric]
          : prev.queryDefinition.metrics.filter(m => m !== metric)
      }
    }));
  };

  const handleDimensionsChange = (dimension: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      queryDefinition: {
        ...prev.queryDefinition,
        dimensions: checked 
          ? [...prev.queryDefinition.dimensions, dimension]
          : prev.queryDefinition.dimensions.filter(d => d !== dimension)
      }
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Назив template-а је обавезан';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Опис template-а је обавезан';
    }

    if (!formData.category) {
      newErrors.category = 'Категорија је обавезна';
    }

    if (formData.queryDefinition.metrics.length === 0) {
      newErrors.metrics = 'Потребно је изабрати најмање једну метрику';
    }

    if (formData.queryDefinition.dimensions.length === 0) {
      newErrors.dimensions = 'Потребно је изабрати најмање једну димензију';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      isPublic: true,
      status: 'draft',
      queryDefinition: {
        metrics: [],
        dimensions: [],
        filters: {},
        dateRange: 'last_30_days'
      },
      layout: {
        type: 'table',
        columns: [],
        sortBy: '',
        sortOrder: 'desc'
      },
      formatting: {
        numberFormat: 'sr',
        dateFormat: 'dd.MM.yyyy',
        showTotals: true,
        showPercentages: false
      }
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <TemplateIcon sx={{ mr: 1 }} />
            {template ? 'Измени Template' : 'Нови Template'}
          </Box>
          <Box>
            <Tooltip title={previewMode ? 'Уреди' : 'Преглед'}>
              <IconButton onClick={() => setPreviewMode(!previewMode)}>
                {previewMode ? <CodeIcon /> : <PreviewIcon />}
              </IconButton>
            </Tooltip>
            <IconButton onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {Object.keys(errors).length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Молимо исправите грешке у форми пре чувања.
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Основне Информације
            </Typography>
          </Grid>

          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Назив Template-а"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
              required
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth error={!!errors.category}>
              <InputLabel>Категорија</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                label="Категорија"
                required
              >
                {availableCategories.map(cat => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Опис"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              error={!!errors.description}
              helperText={errors.description}
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Статус</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                label="Статус"
              >
                <MenuItem value="draft">Нацрт</MenuItem>
                <MenuItem value="active">Активан</MenuItem>
                <MenuItem value="archived">Архивиран</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isPublic}
                  onChange={(e) => handleInputChange('isPublic', e.target.checked)}
                />
              }
              label="Јавни Template (доступан свим корисницима)"
            />
          </Grid>

          {/* Query Definition */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Дефиниција Упита</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormLabel component="legend" error={!!errors.metrics}>
                      Метрике *
                    </FormLabel>
                    <FormGroup>
                      {availableMetrics.map(metric => (
                        <FormControlLabel
                          key={metric}
                          control={
                            <Switch
                              checked={formData.queryDefinition.metrics.includes(metric)}
                              onChange={(e) => handleMetricsChange(metric, e.target.checked)}
                              size="small"
                            />
                          }
                          label={metric.replace(/_/g, ' ')}
                        />
                      ))}
                    </FormGroup>
                    {errors.metrics && (
                      <Typography variant="caption" color="error">
                        {errors.metrics}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormLabel component="legend" error={!!errors.dimensions}>
                      Димензије *
                    </FormLabel>
                    <FormGroup>
                      {availableDimensions.map(dimension => (
                        <FormControlLabel
                          key={dimension}
                          control={
                            <Switch
                              checked={formData.queryDefinition.dimensions.includes(dimension)}
                              onChange={(e) => handleDimensionsChange(dimension, e.target.checked)}
                              size="small"
                            />
                          }
                          label={dimension.replace(/_/g, ' ')}
                        />
                      ))}
                    </FormGroup>
                    {errors.dimensions && (
                      <Typography variant="caption" color="error">
                        {errors.dimensions}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Период Података</InputLabel>
                      <Select
                        value={formData.queryDefinition.dateRange}
                        onChange={(e) => handleNestedChange('queryDefinition', 'dateRange', e.target.value)}
                        label="Период Података"
                      >
                        {dateRangeOptions.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Layout Configuration */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Конфигурација Приказа</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <FormLabel component="legend">Тип Приказа</FormLabel>
                      <RadioGroup
                        value={formData.layout.type}
                        onChange={(e) => handleNestedChange('layout', 'type', e.target.value)}
                      >
                        <FormControlLabel value="table" control={<Radio />} label="Табела" />
                        <FormControlLabel value="chart" control={<Radio />} label="Графикон" />
                        <FormControlLabel value="mixed" control={<Radio />} label="Комбиновано" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>

                  {formData.layout.type === 'chart' && (
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Тип Графикона</InputLabel>
                        <Select
                          value={formData.layout.chartType || ''}
                          onChange={(e) => handleNestedChange('layout', 'chartType', e.target.value)}
                          label="Тип Графикона"
                        >
                          <MenuItem value="line">Линијски</MenuItem>
                          <MenuItem value="bar">Стубичасти</MenuItem>
                          <MenuItem value="pie">Кружни</MenuItem>
                          <MenuItem value="area">Површински</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Formatting Options */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Опције Форматирања</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Формат Бројева</InputLabel>
                      <Select
                        value={formData.formatting.numberFormat}
                        onChange={(e) => handleNestedChange('formatting', 'numberFormat', e.target.value)}
                        label="Формат Бројева"
                      >
                        <MenuItem value="sr">Српски (1.234,56)</MenuItem>
                        <MenuItem value="en">Међународни (1,234.56)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Формат Датума"
                      value={formData.formatting.dateFormat}
                      onChange={(e) => handleNestedChange('formatting', 'dateFormat', e.target.value)}
                      placeholder="dd.MM.yyyy"
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.formatting.showTotals}
                            onChange={(e) => handleNestedChange('formatting', 'showTotals', e.target.checked)}
                          />
                        }
                        label="Прикажи Укупне Вредности"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.formatting.showPercentages}
                            onChange={(e) => handleNestedChange('formatting', 'showPercentages', e.target.checked)}
                          />
                        }
                        label="Прикажи Проценте"
                      />
                    </Box>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Preview Section */}
          {previewMode && (
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Преглед Template-а
              </Typography>
              <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {formData.name || 'Назив Template-а'}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {formData.description || 'Опис template-а'}
                </Typography>
                <Box display="flex" gap={1} mb={2}>
                  <Chip label={formData.category || 'Категорија'} size="small" />
                  <Chip 
                    label={formData.isPublic ? 'Јавни' : 'Приватни'} 
                    size="small" 
                    color={formData.isPublic ? 'success' : 'default'} 
                  />
                  <Chip label={formData.status} size="small" color="info" />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Метрике: {formData.queryDefinition.metrics.join(', ') || 'Није изабрано'}
                </Typography>
                <br />
                <Typography variant="caption" color="text.secondary">
                  Димензије: {formData.queryDefinition.dimensions.join(', ') || 'Није изабрано'}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} startIcon={<CancelIcon />}>
          Откажи
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          startIcon={<SaveIcon />}
          disabled={Object.keys(errors).length > 0}
        >
          {template ? 'Ажурирај' : 'Креирај'} Template
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplateEditDialog; 