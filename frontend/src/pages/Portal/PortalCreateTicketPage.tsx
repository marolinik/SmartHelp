import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Autocomplete,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  AttachFile as AttachFileIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  HelpOutline as HelpIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { RootState } from '../../store/store';
import { ticketApi, CreateTicketData, Category } from '../../services/ticketApi';

// Form validation schema
const createTicketSchema = yup.object({
  subject: yup
    .string()
    .required('Наслов је обавезан')
    .min(5, 'Наслов мора имати најмање 5 карактера')
    .max(200, 'Наслов не може имати више од 200 карактера'),
  description: yup
    .string()
    .required('Опис је обавезан')
    .min(20, 'Опис мора имати најмање 20 карактера')
    .max(5000, 'Опис не може имати више од 5000 карактера'),
  categoryId: yup
    .string()
    .required('Категорија је обавезна'),
  priority: yup
    .string()
    .required('Приоритет је обавезан'),
  tags: yup
    .array()
    .of(yup.string())
    .optional()
});

interface FormData extends CreateTicketData {
  subject: string;
  description: string;
  categoryId: string;
  priority: string;
  tags?: string[];
}

interface AttachedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
}

const PortalCreateTicketPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useSelector((state: RootState) => state.auth);

  const [activeStep, setActiveStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const steps = [
    'Основне информације',
    'Детаљи проблема',
    'Прилози и додатно',
    'Преглед и слање'
  ];

  const priorityOptions = [
    { value: 'low', label: 'Низак', color: 'success', description: 'Није хитно, може сачекати' },
    { value: 'medium', label: 'Средњи', color: 'info', description: 'Стандардан захтев' },
    { value: 'high', label: 'Висок', color: 'warning', description: 'Треба брзо решити' },
    { value: 'critical', label: 'Критичан', color: 'error', description: 'Блокира рад, хитно!' }
  ];

  const commonTags = [
    'Рачунар', 'Софтвер', 'Мрежа', 'Принтер', 'Email', 'Лозинка',
    'Интернет', 'Телефон', 'Програм', 'Приступ', 'Инсталација', 'Грешка'
  ];

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    trigger
  } = useForm<FormData>({
    resolver: yupResolver(createTicketSchema),
    mode: 'onChange',
    defaultValues: {
      subject: '',
      description: '',
      categoryId: '',
      priority: 'medium',
      tags: []
    }
  });

  const watchedValues = watch();
  const selectedCategory = categories.find(cat => cat.id === watchedValues.categoryId);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await ticketApi.getCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleNext = async () => {
    const fieldsToValidate = getFieldsForStep(activeStep);
    const isStepValid = await trigger(fieldsToValidate);
    
    if (isStepValid) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const getFieldsForStep = (step: number): (keyof FormData)[] => {
    switch (step) {
      case 0:
        return ['subject', 'categoryId'];
      case 1:
        return ['description', 'priority'];
      case 2:
        return [];
      case 3:
        return ['subject', 'description', 'categoryId', 'priority'];
      default:
        return [];
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`Фајл ${file.name} је превелик. Максимална величина је 10MB.`);
        continue;
      }

      newFiles.push({
        id: Date.now().toString() + i,
        file,
        name: file.name,
        size: file.size,
        type: file.type
      });
    }

    setAttachedFiles(prev => [...prev, ...newFiles]);
    // Clear input
    event.target.value = '';
  };

  const removeFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const suggestPriorityBasedOnKeywords = (text: string): string => {
    const criticalKeywords = ['не ради', 'блокира', 'хитно', 'критично', 'пао', 'неприступачно'];
    const highKeywords = ['спор', 'проблем', 'грешка', 'не могу'];
    
    const lowerText = text.toLowerCase();
    
    if (criticalKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'critical';
    } else if (highKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'high';
    }
    
    return 'medium';
  };

  const handleDescriptionChange = (value: string) => {
    setValue('description', value);
    
    // Auto-suggest priority based on description keywords
    if (value.length > 20) {
      const suggestedPriority = suggestPriorityBasedOnKeywords(value);
      if (watchedValues.priority === 'medium' && suggestedPriority !== 'medium') {
        setValue('priority', suggestedPriority);
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);
      
      const ticketData: CreateTicketData = {
        subject: data.subject,
        description: data.description,
        categoryId: data.categoryId,
        priority: data.priority,
        tags: data.tags
      };

      const response = await ticketApi.createTicket(ticketData);
      
      setCreatedTicketId(response.data.ticketNumber || response.data.id);
      setSubmitSuccess(true);
      setActiveStep(4); // Move to success step
      
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Грешка при креирању тикета. Покушајте поново.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Основне информације о вашем захтеву
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Молимо унесите кратак и јасан наслов који описује ваш проблем или захтев.
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Controller
                name="subject"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Наслов тикета *"
                    placeholder="нпр. Не могу да приступим email-у"
                    error={!!errors.subject}
                    helperText={errors.subject?.message}
                    variant="outlined"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.categoryId}>
                    <InputLabel>Категорија *</InputLabel>
                    <Select
                      {...field}
                      label="Категорија *"
                      disabled={loadingCategories}
                    >
                      {categories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {category.icon && <span style={{ marginRight: 8 }}>{category.icon}</span>}
                            {category.name}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.categoryId && (
                      <FormHelperText>{errors.categoryId.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {selectedCategory && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>{selectedCategory.name}:</strong> {selectedCategory.description}
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Детаљан опис проблема
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Опишите детаљно ваш проблем или захтев. Што више информација дате, то ће брже бити решено.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    fullWidth
                    multiline
                    rows={6}
                    label="Опис проблема *"
                    placeholder="Опишите шта се дешава, када се проблем јавио, да ли сте покушали нешто да урадите..."
                    error={!!errors.description}
                    helperText={errors.description?.message || `${field.value.length}/5000 карактера`}
                    variant="outlined"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.priority}>
                    <InputLabel>Приоритет *</InputLabel>
                    <Select
                      {...field}
                      label="Приоритет *"
                    >
                      {priorityOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Chip
                              label={option.label}
                              color={option.color as any}
                              size="small"
                              sx={{ mr: 1 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {option.description}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.priority && (
                      <FormHelperText>{errors.priority.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    multiple
                    freeSolo
                    options={commonTags}
                    value={field.value || []}
                    onChange={(_, newValue) => field.onChange(newValue)}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Тагови (опционо)"
                        placeholder="Додајте тагове..."
                        helperText="Притисните Enter да додате нови таг"
                      />
                    )}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Савет:</strong> Приложите скриншотове грешака или видео записе ако је могуће. То помаже да брже решимо проблем.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Прилози и додатне информације
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Приложите фајлове који могу помоћи у решавању проблема (скриншотове, лог фајлове, документе).
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  textAlign: 'center',
                  border: `2px dashed ${theme.palette.divider}`,
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    backgroundColor: theme.palette.action.hover
                  }
                }}
              >
                <input
                  accept="*/*"
                  style={{ display: 'none' }}
                  id="file-upload"
                  multiple
                  type="file"
                  onChange={handleFileUpload}
                />
                <label htmlFor="file-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<AttachFileIcon />}
                    size="large"
                  >
                    Изаберите фајлове
                  </Button>
                </label>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Или превуците фајлове овде. Максимално 10MB по фајлу.
                </Typography>
              </Paper>
            </Grid>

            {attachedFiles.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Приложени фајлови ({attachedFiles.length})
                </Typography>
                <List>
                  {attachedFiles.map((file) => (
                    <ListItem
                      key={file.id}
                      sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        mb: 1
                      }}
                    >
                      <ListItemIcon>
                        <AttachFileIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={`${formatFileSize(file.size)} • ${file.type}`}
                      />
                      <IconButton
                        edge="end"
                        onClick={() => removeFile(file.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </Grid>
            )}

            <Grid item xs={12}>
              <Alert severity="warning">
                <Typography variant="body2">
                  <strong>Пажња:</strong> Немојте прилагати фајлове који садрже лозинке или осетљиве информације.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Преглед тикета пре слања
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Молимо проверите све информације пре слања тикета.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">Наслов</Typography>
                      <Typography variant="body1">{watchedValues.subject}</Typography>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">Категорија</Typography>
                      <Typography variant="body1">
                        {selectedCategory?.name}
                      </Typography>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">Приоритет</Typography>
                      <Chip
                        label={priorityOptions.find(p => p.value === watchedValues.priority)?.label}
                        color={priorityOptions.find(p => p.value === watchedValues.priority)?.color as any}
                        size="small"
                      />
                    </Grid>

                    {watchedValues.tags && watchedValues.tags.length > 0 && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">Тагови</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {watchedValues.tags.map((tag, index) => (
                            <Chip key={index} label={tag} variant="outlined" size="small" />
                          ))}
                        </Box>
                      </Grid>
                    )}

                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">Опис</Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          whiteSpace: 'pre-wrap',
                          maxHeight: 200,
                          overflow: 'auto',
                          backgroundColor: theme.palette.grey[50],
                          p: 2,
                          borderRadius: 1
                        }}
                      >
                        {watchedValues.description}
                      </Typography>
                    </Grid>

                    {attachedFiles.length > 0 && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Прилози ({attachedFiles.length})
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {attachedFiles.map((file) => (
                            <Chip
                              key={file.id}
                              label={`${file.name} (${formatFileSize(file.size)})`}
                              variant="outlined"
                              size="small"
                              icon={<AttachFileIcon />}
                            />
                          ))}
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  Након слања, добићете број тикета и можете пратити статус у секцији "Моји тикети".
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        );

      case 4:
        return (
          <Box textAlign="center" py={4}>
            <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Тикет је успешно креиран!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Ваш тикет број <strong>{createdTicketId}</strong> је послат тиму за подршку.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Очекивани одговор у року од 2 сата током радног времена.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                onClick={() => navigate('/portal/tickets')}
              >
                Прикажи моје тикете
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/portal/dashboard')}
              >
                Назад на почетну
              </Button>
            </Box>
          </Box>
        );

      default:
        return 'Непознат корак';
    }
  };

  if (submitSuccess && activeStep === 4) {
    return (
      <Box>
        {renderStepContent(4)}
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate('/portal/dashboard')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Креирај нови тикет
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Пратите кораке да бисте креирали тикет за подршку
        </Typography>
      </Box>

      {/* Stepper */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Form Content */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            {renderStepContent(activeStep)}

            {/* Navigation Buttons */}
            {activeStep < 4 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                  disabled={activeStep === 0}
                  onClick={handleBack}
                  startIcon={<ArrowBackIcon />}
                >
                  Назад
                </Button>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  {activeStep === steps.length - 1 ? (
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={!isValid || isSubmitting}
                      startIcon={isSubmitting ? undefined : <SendIcon />}
                    >
                      {isSubmitting ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <LinearProgress sx={{ width: 100, mr: 1 }} />
                          Шаљем...
                        </Box>
                      ) : (
                        'Пошаљи тикет'
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<ArrowForwardIcon />}
                    >
                      Следеће
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PortalCreateTicketPage; 