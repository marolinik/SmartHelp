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
  InputAdornment,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  Container,
  Avatar,
  Badge,
  CircularProgress,
  Autocomplete,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  Search as SearchIcon,
  Category as CategoryIcon,
  Article as ArticleIcon,
  AccessTime as RecentIcon,
  TrendingUp as PopularIcon,
  Visibility as ViewIcon,
  ThumbUp as ThumbUpIcon,
  NavigateNext as NavigateNextIcon,
  Help as HelpIcon,
  Star as StarIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';

interface KbCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  articleCount: number;
  children?: KbCategory[];
}

interface KbArticle {
  id: string;
  title: string;
  summary?: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    icon?: string;
  };
  tags?: string[];
  viewCount: number;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SearchSuggestion {
  id: string;
  title: string;
  type: 'article' | 'category';
}

const KnowledgeBasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = useState<KbArticle[]>([]);
  const [searchSuggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [featuredArticles, setFeaturedArticles] = useState<KbArticle[]>([]);
  const [recentArticles, setRecentArticles] = useState<KbArticle[]>([]);
  const [popularArticles, setPopularArticles] = useState<KbArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get('category')
  );

  // Учитај почетне податке
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // Паралелно учитавање свих података
      const [categoriesRes, recentRes, popularRes] = await Promise.all([
        api.get('/kb/categories'),
        api.get('/kb/recent?limit=6'),
        api.get('/kb/popular?limit=6')
      ]);

      if (categoriesRes.data.success) {
        setCategories(categoriesRes.data.data);
      }

      if (recentRes.data.success) {
        setRecentArticles(recentRes.data.data);
      }

      if (popularRes.data.success) {
        setPopularArticles(popularRes.data.data);
        // Користи популарне чланке као featured
        setFeaturedArticles(popularRes.data.data.slice(0, 3));
      }

    } catch (error) {
      console.error('Грешка при учитавању података:', error);
    } finally {
      setLoading(false);
    }
  };

  // Претрага чланака
  const searchArticles = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const params = new URLSearchParams({
        q: query,
        limit: '20',
        ...(selectedCategory && { categoryId: selectedCategory })
      });

      const response = await api.get(`/kb/search?${params}`);
      
      if (response.data.success) {
        setSearchResults(response.data.data.articles);
      }
    } catch (error) {
      console.error('Грешка при претрази:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Добиј предлоге за претрагу
  const getSearchSuggestions = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await api.get(`/kb/search/suggestions?q=${encodeURIComponent(query)}&limit=5`);
      
      if (response.data.success) {
        setSuggestions(response.data.data);
      }
    } catch (error) {
      console.error('Грешка при добијању предлога:', error);
      setSuggestions([]);
    }
  };

  // Обради претрагу
  const handleSearch = (query: string = searchQuery) => {
    if (!query.trim()) return;
    
    const params = new URLSearchParams();
    params.set('q', query);
    if (selectedCategory) {
      params.set('category', selectedCategory);
    }
    
    navigate(`/knowledge-base?${params}`);
    searchArticles(query);
  };

  // Изабери категорију
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const params = new URLSearchParams();
    if (searchQuery) {
      params.set('q', searchQuery);
    }
    params.set('category', categoryId);
    navigate(`/knowledge-base?${params}`);
    
    if (searchQuery) {
      searchArticles(searchQuery);
    }
  };

  // Очисти филтере
  const clearFilters = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    setSearchResults([]);
    navigate('/knowledge-base');
  };

  // Debounce за претрагу
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchArticles(searchQuery);
        getSearchSuggestions(searchQuery);
      } else {
        setSearchResults([]);
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Рендеруј article card
  const renderArticleCard = (article: KbArticle, showCategory = true) => (
    <Card 
      key={article.id} 
      sx={{ 
        height: '100%', 
        cursor: 'pointer',
        '&:hover': { 
          boxShadow: 3,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
      onClick={() => navigate(`/knowledge-base/article/${article.id}`)}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Typography variant="h6" component="h3" sx={{ flexGrow: 1, pr: 1 }}>
            {article.title}
          </Typography>
          <Box display="flex" alignItems="center" gap={0.5}>
            <ViewIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              {article.viewCount}
            </Typography>
          </Box>
        </Box>

        {article.summary && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {article.summary}
          </Typography>
        )}

        <Box display="flex" flexDirection="column" gap={1}>
          {showCategory && article.category && (
            <Box display="flex" alignItems="center" gap={1}>
              {article.category.icon && (
                <span style={{ fontSize: '0.9rem' }}>{article.category.icon}</span>
              )}
              <Typography variant="caption" color="primary">
                {article.category.name}
              </Typography>
            </Box>
          )}

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <ThumbUpIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {article.helpfulCount} корисно
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {format(new Date(article.updatedAt), 'dd.MM.yyyy', { locale: sr })}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Рендеруј category card
  const renderCategoryCard = (category: KbCategory) => (
    <Card 
      key={category.id}
      sx={{ 
        cursor: 'pointer',
        '&:hover': { 
          boxShadow: 2,
          backgroundColor: 'action.hover'
        }
      }}
      onClick={() => handleCategorySelect(category.id)}
    >
      <CardContent>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {category.icon ? (
              <span style={{ fontSize: '1.5rem' }}>{category.icon}</span>
            ) : (
              <FolderIcon />
            )}
          </Avatar>
          
          <Box flexGrow={1}>
            <Typography variant="h6" component="h3">
              {category.name}
            </Typography>
            {category.description && (
              <Typography variant="body2" color="text.secondary">
                {category.description}
              </Typography>
            )}
          </Box>
          
          <Badge badgeContent={category.articleCount} color="primary">
            <ArticleIcon color="action" />
          </Badge>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Учитавам базу знања...
        </Typography>
      </Box>
    );
  }

  const showSearchResults = searchQuery.trim() !== '';

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header секција */}
      <Box textAlign="center" mb={6}>
        <Typography variant="h3" component="h1" gutterBottom>
          📚 База знања
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Пронађите одговоре на ваша питања у нашој опсежној бази знања
        </Typography>

        {/* Претрага */}
        <Paper sx={{ mt: 4, mb: 3 }}>
          <Box p={2}>
            <Autocomplete
              freeSolo
              options={searchSuggestions}
              getOptionLabel={(option) => 
                typeof option === 'string' ? option : option.title
              }
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box display="flex" alignItems="center" gap={1} width="100%">
                    {option.type === 'article' ? <ArticleIcon /> : <CategoryIcon />}
                    <Typography>{option.title}</Typography>
                  </Box>
                </Box>
              )}
              onInputChange={(event, newValue) => {
                setSearchQuery(newValue);
              }}
              onChange={(event, value) => {
                if (typeof value === 'string') {
                  handleSearch(value);
                } else if (value?.title) {
                  handleSearch(value.title);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Претражите чланке, кључне речи, категорије..."
                  variant="outlined"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: searchLoading ? (
                      <CircularProgress size={20} />
                    ) : (
                      params.InputProps.endAdornment
                    )
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
              )}
            />

            {/* Филтери */}
            {(selectedCategory || searchQuery) && (
              <Box mt={2} display="flex" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="body2" color="text.secondary">
                  Активни филтери:
                </Typography>
                
                {selectedCategory && (
                  <Chip
                    label={`Категорија: ${categories.find(c => c.id === selectedCategory)?.name}`}
                    onDelete={() => {
                      setSelectedCategory(null);
                      const params = new URLSearchParams();
                      if (searchQuery) params.set('q', searchQuery);
                      navigate(`/knowledge-base${params.toString() ? '?' + params : ''}`);
                    }}
                    color="primary"
                    variant="outlined"
                  />
                )}
                
                {searchQuery && (
                  <Chip
                    label={`Претрага: "${searchQuery}"`}
                    onDelete={() => {
                      setSearchQuery('');
                      const params = new URLSearchParams();
                      if (selectedCategory) params.set('category', selectedCategory);
                      navigate(`/knowledge-base${params.toString() ? '?' + params : ''}`);
                    }}
                    color="primary"
                    variant="outlined"
                  />
                )}
                
                <Button size="small" onClick={clearFilters}>
                  Очисти све
                </Button>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Резултати претраге */}
      {showSearchResults && (
        <Box mb={4}>
          <Typography variant="h5" gutterBottom>
            Резултати претраге
            {searchLoading && <CircularProgress size={20} sx={{ ml: 2 }} />}
          </Typography>
          
          {searchResults.length === 0 && !searchLoading && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <HelpIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Нема резултата за "{searchQuery}"
              </Typography>
              <Typography color="text.secondary" paragraph>
                Покушајте са другачијим кључним речима или прегледајте категорије испод.
              </Typography>
              <Button variant="outlined" onClick={clearFilters}>
                Очисти претрагу
              </Button>
            </Paper>
          )}

          {searchResults.length > 0 && (
            <Grid container spacing={3}>
              {searchResults.map(article => (
                <Grid item xs={12} md={6} lg={4} key={article.id}>
                  {renderArticleCard(article)}
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Садржај без претраге */}
      {!showSearchResults && (
        <>
          {/* Истакнути чланци */}
          {featuredArticles.length > 0 && (
            <Box mb={6}>
              <Typography variant="h5" gutterBottom display="flex" alignItems="center" gap={1}>
                <StarIcon color="primary" />
                Истакнути чланци
              </Typography>
              <Grid container spacing={3}>
                {featuredArticles.map(article => (
                  <Grid item xs={12} md={4} key={article.id}>
                    {renderArticleCard(article)}
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          <Grid container spacing={4}>
            {/* Категорије */}
            <Grid item xs={12} md={4}>
              <Typography variant="h5" gutterBottom display="flex" alignItems="center" gap={1}>
                <CategoryIcon color="primary" />
                Категорије
              </Typography>
              <List>
                {categories.slice(0, 8).map(category => (
                  <ListItem 
                    key={category.id}
                    button
                    onClick={() => handleCategorySelect(category.id)}
                    sx={{ 
                      borderRadius: 1, 
                      mb: 1,
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <ListItemIcon>
                      {category.icon ? (
                        <span style={{ fontSize: '1.5rem' }}>{category.icon}</span>
                      ) : (
                        <FolderIcon />
                      )}
                    </ListItemIcon>
                    <ListItemText 
                      primary={category.name}
                      secondary={`${category.articleCount} чланака`}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>

            {/* Недавни чланци */}
            <Grid item xs={12} md={4}>
              <Typography variant="h5" gutterBottom display="flex" alignItems="center" gap={1}>
                <RecentIcon color="primary" />
                Недавно додато
              </Typography>
              <List>
                {recentArticles.map(article => (
                  <ListItem 
                    key={article.id}
                    button
                    onClick={() => navigate(`/knowledge-base/article/${article.id}`)}
                    sx={{ 
                      borderRadius: 1, 
                      mb: 1,
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <ListItemIcon>
                      <ArticleIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={article.title}
                      secondary={format(new Date(article.updatedAt), 'dd.MM.yyyy', { locale: sr })}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>

            {/* Популарни чланци */}
            <Grid item xs={12} md={4}>
              <Typography variant="h5" gutterBottom display="flex" alignItems="center" gap={1}>
                <PopularIcon color="primary" />
                Најпопуларније
              </Typography>
              <List>
                {popularArticles.map(article => (
                  <ListItem 
                    key={article.id}
                    button
                    onClick={() => navigate(`/knowledge-base/article/${article.id}`)}
                    sx={{ 
                      borderRadius: 1, 
                      mb: 1,
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <ListItemIcon>
                      <Badge badgeContent={article.viewCount} color="primary" max={999}>
                        <ArticleIcon />
                      </Badge>
                    </ListItemIcon>
                    <ListItemText 
                      primary={article.title}
                      secondary={`${article.helpfulCount} корисно • ${article.viewCount} прегледа`}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  );
};

export default KnowledgeBasePage; 