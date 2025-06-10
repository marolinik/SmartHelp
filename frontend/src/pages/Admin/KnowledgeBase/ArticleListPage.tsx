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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Tooltip,
  CircularProgress,
  InputAdornment,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Article as ArticleIcon,
  CheckCircle as PublishedIcon,
  Schedule as DraftIcon,
  RateReview as ReviewIcon,
  Archive as ArchivedIcon,
  Cancel as RejectedIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';

// Простан snackbar hook замена за notistack
const useSnackbar = () => ({
  enqueueSnackbar: (message: string, options?: { variant?: 'success' | 'error' | 'warning' | 'info' }) => {
    console.log(`${options?.variant?.toUpperCase() || 'INFO'}: ${message}`);
  }
});

interface KbArticle {
  id: string;
  title: string;
  summary?: string;
  content: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    icon?: string;
  };
  tags?: string[];
  authorId: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  viewCount: number;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

interface ArticleFilters {
  search: string;
  status: string;
  categoryId: string;
  authorId: string;
  tags: string[];
}

const ArticleListPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);
  
  const [filters, setFilters] = useState<ArticleFilters>({
    search: '',
    status: '',
    categoryId: '',
    authorId: '',
    tags: []
  });

  // Статуси чланака са српским лабелима
  const statusLabels = {
    draft: 'Нацрт',
    review: 'Преглед', 
    published: 'Објављено',
    archived: 'Архивирано',
    rejected: 'Одбачено'
  };

  const statusIcons = {
    draft: <DraftIcon />,
    review: <ReviewIcon />,
    published: <PublishedIcon />,
    archived: <ArchivedIcon />,
    rejected: <RejectedIcon />
  };

  const statusColors = {
    draft: 'default' as const,
    review: 'warning' as const,
    published: 'success' as const,
    archived: 'secondary' as const,
    rejected: 'error' as const
  };

  // Учитај чланке
  const fetchArticles = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.categoryId && { categoryId: filters.categoryId }),
        ...(filters.authorId && { authorId: filters.authorId }),
        ...(filters.tags.length > 0 && { tags: filters.tags.join(',') })
      });

      const response = await api.get(`/kb/articles?${params}`);
      
      if (response.data.success) {
        setArticles(response.data.data.articles);
        setTotalCount(response.data.data.total);
      }
    } catch (error: any) {
      console.error('Грешка при учитавању чланака:', error);
      enqueueSnackbar('Грешка при учитавању чланака', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Обриши чланак
  const deleteArticle = async (articleId: string) => {
    try {
      await api.delete(`/kb/articles/${articleId}`);
      enqueueSnackbar('Чланак је успешно обрисан', { variant: 'success' });
      fetchArticles();
    } catch (error: any) {
      console.error('Грешка при брисању чланка:', error);
      const message = error.response?.data?.message || 'Грешка при брисању чланка';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // Промени статус чланка
  const changeArticleStatus = async (articleId: string, newStatus: string) => {
    try {
      await api.put(`/kb/articles/${articleId}/workflow/status`, { status: newStatus });
      enqueueSnackbar('Статус чланка је успешно промењен', { variant: 'success' });
      fetchArticles();
    } catch (error: any) {
      console.error('Грешка при промени статуса:', error);
      const message = error.response?.data?.message || 'Грешка при промени статуса';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // Отвори мени за акције
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, article: KbArticle) => {
    setAnchorEl(event.currentTarget);
    setSelectedArticle(article);
  };

  // Затвори мени
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedArticle(null);
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

  // Примени филтере
  const applyFilters = () => {
    setPage(0);
    fetchArticles();
  };

  // Ресетуј филтере
  const resetFilters = () => {
    setFilters({
      search: '',
      status: '',
      categoryId: '',
      authorId: '',
      tags: []
    });
    setPage(0);
  };

  useEffect(() => {
    fetchArticles();
  }, [page, rowsPerPage]);

  // Trigger поновног учитавања када се филтери промене
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filters.search !== '') {
        fetchArticles();
      }
    }, 500); // Debounce претрагу

    return () => clearTimeout(timeoutId);
  }, [filters.search]);

  if (loading && articles.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Учитавам чланке...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <ArticleIcon />
          Управљање чланцима
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/kb/articles/new')}
        >
          Нови чланак
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader 
              title="Филтрирање и претрага"
              action={
                <Button
                  variant="outlined"
                  onClick={resetFilters}
                  size="small"
                >
                  Ресетуј
                </Button>
              }
            />
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    placeholder="Претражи чланке..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Статус</InputLabel>
                    <Select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      label="Статус"
                    >
                      <MenuItem value="">
                        <em>Сви статуси</em>
                      </MenuItem>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          <Box display="flex" alignItems="center" gap={1}>
                            {statusIcons[value as keyof typeof statusIcons]}
                            {label}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Категорија</InputLabel>
                    <Select
                      value={filters.categoryId}
                      onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                      label="Категорија"
                    >
                      <MenuItem value="">
                        <em>Све категорије</em>
                      </MenuItem>
                      {/* TODO: Учитај категорије из API-ја */}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    variant="contained"
                    onClick={applyFilters}
                    fullWidth
                    startIcon={<FilterIcon />}
                  >
                    Примени
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader title="Листа чланака" />
            <CardContent sx={{ p: 0 }}>
              {articles.length === 0 ? (
                <Box p={3}>
                  <Alert severity="info">
                    {filters.search || filters.status || filters.categoryId
                      ? 'Нема чланака који одговарају изабраним филтерима.'
                      : 'Нема креираних чланака. Додајте први чланак да почнете.'
                    }
                  </Alert>
                </Box>
              ) : (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Наслов</TableCell>
                          <TableCell>Статус</TableCell>
                          <TableCell>Категорија</TableCell>
                          <TableCell>Аутор</TableCell>
                          <TableCell align="center">Прегледи</TableCell>
                          <TableCell align="center">Корисно</TableCell>
                          <TableCell>Креирано</TableCell>
                          <TableCell align="center">Акције</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {articles.map((article) => (
                          <TableRow key={article.id} hover>
                            <TableCell>
                              <Box>
                                <Typography variant="subtitle2" noWrap sx={{ maxWidth: 200 }}>
                                  {article.title}
                                </Typography>
                                {article.summary && (
                                  <Typography 
                                    variant="body2" 
                                    color="text.secondary" 
                                    noWrap 
                                    sx={{ maxWidth: 200 }}
                                  >
                                    {article.summary}
                                  </Typography>
                                )}
                                {article.tags && article.tags.length > 0 && (
                                  <Box mt={0.5}>
                                    {article.tags.slice(0, 2).map((tag, index) => (
                                      <Chip
                                        key={index}
                                        label={tag}
                                        size="small"
                                        variant="outlined"
                                        sx={{ mr: 0.5, fontSize: '0.7rem' }}
                                      />
                                    ))}
                                    {article.tags.length > 2 && (
                                      <Typography variant="caption" color="text.secondary">
                                        +{article.tags.length - 2} више
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                              </Box>
                            </TableCell>
                            
                            <TableCell>
                              <Chip
                                label={statusLabels[article.status]}
                                color={statusColors[article.status]}
                                size="small"
                                icon={statusIcons[article.status]}
                              />
                            </TableCell>
                            
                            <TableCell>
                              {article.category ? (
                                <Box display="flex" alignItems="center" gap={1}>
                                  {article.category.icon && (
                                    <span style={{ fontSize: '1rem' }}>
                                      {article.category.icon}
                                    </span>
                                  )}
                                  <Typography variant="body2">
                                    {article.category.name}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  Без категорије
                                </Typography>
                              )}
                            </TableCell>
                            
                            <TableCell>
                              {article.author ? (
                                <Typography variant="body2">
                                  {article.author.firstName} {article.author.lastName}
                                </Typography>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  Непознат аутор
                                </Typography>
                              )}
                            </TableCell>
                            
                            <TableCell align="center">
                              <Typography variant="body2">
                                {article.viewCount}
                              </Typography>
                            </TableCell>
                            
                            <TableCell align="center">
                              <Typography variant="body2">
                                {article.helpfulCount}
                              </Typography>
                            </TableCell>
                            
                            <TableCell>
                              <Typography variant="body2">
                                {format(new Date(article.createdAt), 'dd.MM.yyyy', { locale: sr })}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {format(new Date(article.createdAt), 'HH:mm', { locale: sr })}
                              </Typography>
                            </TableCell>
                            
                            <TableCell align="center">
                              <Box display="flex" justifyContent="center" gap={0.5}>
                                <Tooltip title="Прегледај чланак">
                                  <IconButton
                                    size="small"
                                    onClick={() => navigate(`/admin/kb/articles/${article.id}/view`)}
                                  >
                                    <ViewIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Уреди чланак">
                                  <IconButton
                                    size="small"
                                    onClick={() => navigate(`/admin/kb/articles/${article.id}/edit`)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Више акција">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => handleMenuOpen(e, article)}
                                  >
                                    <MoreVertIcon fontSize="small" />
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
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    component="div"
                    count={totalCount}
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

      {/* Мени за акције */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedArticle && (
          <>
            {selectedArticle.status === 'draft' && (
              <MenuItem onClick={() => {
                changeArticleStatus(selectedArticle.id, 'review');
                handleMenuClose();
              }}>
                <ListItemIcon>
                  <ReviewIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Пошаљи на преглед</ListItemText>
              </MenuItem>
            )}
            
            {selectedArticle.status === 'review' && (
              <>
                <MenuItem onClick={() => {
                  changeArticleStatus(selectedArticle.id, 'published');
                  handleMenuClose();
                }}>
                  <ListItemIcon>
                    <PublishedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Објави чланак</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => {
                  changeArticleStatus(selectedArticle.id, 'rejected');
                  handleMenuClose();
                }}>
                  <ListItemIcon>
                    <RejectedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Одбаци чланак</ListItemText>
                </MenuItem>
              </>
            )}
            
            {selectedArticle.status === 'published' && (
              <MenuItem onClick={() => {
                changeArticleStatus(selectedArticle.id, 'archived');
                handleMenuClose();
              }}>
                <ListItemIcon>
                  <ArchivedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Архивирај чланак</ListItemText>
              </MenuItem>
            )}
            
            <MenuItem onClick={() => {
              deleteArticle(selectedArticle.id);
              handleMenuClose();
            }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Обриши чланак</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
};

export default ArticleListPage; 