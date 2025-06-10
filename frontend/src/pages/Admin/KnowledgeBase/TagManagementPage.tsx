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
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  CircularProgress,
  Autocomplete,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Tag as TagIcon,
  Search as SearchIcon,
  Label as LabelIcon
} from '@mui/icons-material';
import api from '../../../services/api';

// Простан snackbar hook замена за notistack
const useSnackbar = () => ({
  enqueueSnackbar: (message: string, options?: { variant?: 'success' | 'error' | 'warning' | 'info' }) => {
    console.log(`${options?.variant?.toUpperCase() || 'INFO'}: ${message}`);
  }
});

interface KbTag {
  id: string;
  name: string;
  description?: string;
  color?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TagFormData {
  name: string;
  description: string;
  color: string;
}

const TagManagementPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [tags, setTags] = useState<KbTag[]>([]);
  const [filteredTags, setFilteredTags] = useState<KbTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<KbTag | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<KbTag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [formData, setFormData] = useState<TagFormData>({
    name: '',
    description: '',
    color: '#1976d2'
  });

  const [formErrors, setFormErrors] = useState<Partial<TagFormData>>({});

  // Предефинисане боје за тагове
  const predefinedColors = [
    '#1976d2', // blue
    '#388e3c', // green
    '#f57c00', // orange
    '#d32f2f', // red
    '#7b1fa2', // purple
    '#303f9f', // indigo
    '#c2185b', // pink
    '#00796b', // teal
    '#5d4037', // brown
    '#616161'  // grey
  ];

  // Учитај тагове
  const fetchTags = async () => {
    try {
      setLoading(true);
      // Симулирамо API позив за тагове
      // У стварности би ово било: const response = await api.get('/kb/tags');
      const mockTags: KbTag[] = [
        {
          id: '1',
          name: 'Техничка подршка',
          description: 'Тагови везани за техничку подршку',
          color: '#1976d2',
          usageCount: 15,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Упутства',
          description: 'Корисничка упутства и водичи',
          color: '#388e3c',
          usageCount: 8,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      setTags(mockTags);
      setFilteredTags(mockTags);
    } catch (error: any) {
      console.error('Грешка при учитавању тагова:', error);
      enqueueSnackbar('Грешка при учитавању тагова', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Филтрирај тагове на основу претраге
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTags(tags);
    } else {
      const filtered = tags.filter(tag =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tag.description && tag.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredTags(filtered);
    }
    setPage(0); // Ресетуј страницу при претрази
  }, [searchQuery, tags]);

  // Отвори dialog за додавање/едитовање
  const openDialog = (tag?: KbTag) => {
    if (tag) {
      setEditingTag(tag);
      setFormData({
        name: tag.name,
        description: tag.description || '',
        color: tag.color || '#1976d2'
      });
    } else {
      setEditingTag(null);
      setFormData({
        name: '',
        description: '',
        color: '#1976d2'
      });
    }
    setFormErrors({});
    setDialogOpen(true);
  };

  // Затвори dialog
  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTag(null);
    setFormData({
      name: '',
      description: '',
      color: '#1976d2'
    });
    setFormErrors({});
  };

  // Валидација форме
  const validateForm = (): boolean => {
    const errors: Partial<TagFormData> = {};

    if (!formData.name.trim()) {
      errors.name = 'Назив тага је обавезан';
    } else if (formData.name.length < 2) {
      errors.name = 'Назив мора имати најмање 2 карактера';
    } else if (formData.name.length > 50) {
      errors.name = 'Назив може имати највише 50 карактера';
    }

    // Провери да ли таг са истим именом већ постоји
    const existingTag = tags.find(tag => 
      tag.name.toLowerCase() === formData.name.toLowerCase() && 
      (!editingTag || tag.id !== editingTag.id)
    );
    if (existingTag) {
      errors.name = 'Таг са овим именом већ постоји';
    }

    if (formData.description && formData.description.length > 200) {
      errors.description = 'Опис може имати највише 200 карактера';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Сачувај таг
  const saveTag = async () => {
    if (!validateForm()) return;

    try {
      const tagData = {
        ...formData,
        description: formData.description || undefined
      };

      if (editingTag) {
        // Ажурирај постојећи таг
        // await api.put(`/kb/tags/${editingTag.id}`, tagData);
        enqueueSnackbar('Таг је успешно ажуриран', { variant: 'success' });
      } else {
        // Креирај нови таг
        // await api.post('/kb/tags', tagData);
        enqueueSnackbar('Таг је успешно креиран', { variant: 'success' });
      }

      closeDialog();
      fetchTags();
    } catch (error: any) {
      console.error('Грешка при чувању тага:', error);
      const message = error.response?.data?.message || 'Грешка при чувању тага';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // Отвори dialog за брисање
  const openDeleteDialog = (tag: KbTag) => {
    setTagToDelete(tag);
    setDeleteDialogOpen(true);
  };

  // Обриши таг
  const deleteTag = async () => {
    if (!tagToDelete) return;

    try {
      // await api.delete(`/kb/tags/${tagToDelete.id}`);
      enqueueSnackbar('Таг је успешно обрисан', { variant: 'success' });
      setDeleteDialogOpen(false);
      setTagToDelete(null);
      fetchTags();
    } catch (error: any) {
      console.error('Грешка при брисању тага:', error);
      const message = error.response?.data?.message || 'Грешка при брисању тага';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // Промени страницу
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Промени број редова по страници
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    fetchTags();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Учитавам тагове...
        </Typography>
      </Box>
    );
  }

  const paginatedTags = filteredTags.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <TagIcon />
          Управљање таговима
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openDialog()}
        >
          Додај таг
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader 
              title="Листа тагова"
              subheader="Организујте тагове за лакше категорисање чланака"
            />
            <CardContent>
              {/* Претрага */}
              <Box mb={3}>
                <TextField
                  fullWidth
                  placeholder="Претражите тагове..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              {filteredTags.length === 0 ? (
                <Alert severity="info">
                  {searchQuery ? 'Нема тагова који одговарају претрази.' : 'Нема креираних тагова. Додајте први таг да почнете.'}
                </Alert>
              ) : (
                <>
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Назив</TableCell>
                          <TableCell>Опис</TableCell>
                          <TableCell align="center">Коришћење</TableCell>
                          <TableCell align="center">Боја</TableCell>
                          <TableCell align="center">Акције</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedTags.map((tag) => (
                          <TableRow key={tag.id} hover>
                            <TableCell>
                              <Chip
                                label={tag.name}
                                style={{ backgroundColor: tag.color, color: 'white' }}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {tag.description || 'Нема описа'}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${tag.usageCount} чланака`}
                                variant="outlined"
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Box
                                sx={{
                                  width: 24,
                                  height: 24,
                                  backgroundColor: tag.color,
                                  borderRadius: '50%',
                                  margin: '0 auto',
                                  border: '1px solid #ccc'
                                }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Box display="flex" justifyContent="center" gap={0.5}>
                                <Tooltip title="Уреди таг">
                                  <IconButton
                                    size="small"
                                    onClick={() => openDialog(tag)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Обриши таг">
                                  <IconButton
                                    size="small"
                                    onClick={() => openDeleteDialog(tag)}
                                    color="error"
                                    disabled={tag.usageCount > 0}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={filteredTags.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    labelRowsPerPage="Редова по страници:"
                    labelDisplayedRows={({ from, to, count }) => 
                      `${from}-${to} од ${count !== -1 ? count : `више од ${to}`}`
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog за додавање/едитовање тага */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTag ? 'Уреди таг' : 'Додај нови таг'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Назив тага"
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
              rows={2}
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Боја тага
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {predefinedColors.map((color) => (
                  <Box
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    sx={{
                      width: 32,
                      height: 32,
                      backgroundColor: color,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      border: formData.color === color ? '3px solid #000' : '1px solid #ccc',
                      '&:hover': {
                        transform: 'scale(1.1)'
                      }
                    }}
                  />
                ))}
              </Box>
              <TextField
                label="Прилагођена боја (hex)"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                fullWidth
                sx={{ mt: 2 }}
                placeholder="#1976d2"
              />
            </Box>

            {/* Preview тага */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Преглед
              </Typography>
              <Chip
                label={formData.name || 'Назив тага'}
                style={{ 
                  backgroundColor: formData.color, 
                  color: 'white',
                  fontWeight: 'bold'
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>
            Откажи
          </Button>
          <Button onClick={saveTag} variant="contained">
            {editingTag ? 'Ажурирај' : 'Креирај'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog за потврду брисања */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Потврди брисање</DialogTitle>
        <DialogContent>
          <Typography>
            Да ли сте сигурни да желите да обришете таг "{tagToDelete?.name}"?
          </Typography>
          {tagToDelete && tagToDelete.usageCount > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Овај таг се користи у {tagToDelete.usageCount} чланака. Брисање тага ће га уклонити из свих чланака.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Откажи
          </Button>
          <Button onClick={deleteTag} color="error" variant="contained">
            Обриши
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TagManagementPage; 