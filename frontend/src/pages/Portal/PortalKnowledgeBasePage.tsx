import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Skeleton,
  Alert,
  Autocomplete,
  Paper,
  Divider,
  IconButton,
  Button,
  useTheme,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  MenuBook as KnowledgeIcon,
  Folder as CategoryIcon,
  TrendingUp as TrendingIcon,
  Schedule as RecentIcon,
  Star as PopularIcon,
  Article as ArticleIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  ThumbUp as LikeIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';

import { knowledgeBaseApi, KbArticle, KbCategory } from '../../services/knowledgeBaseApi';

interface SearchFilters {
  categoryId?: string;
  tags?: string[];
  sortBy?: 'relevance' | 'date' | 'popularity' | 'title';
}

const PortalKnowledgeBasePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<KbArticle[]>([]);
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [popularArticles, setPopularArticles] = useState<KbArticle[]>([]);
  const [recentArticles, setRecentArticles] = useState<KbArticle[]>([]);
  const [featuredArticles, setFeaturedArticles] = useState<KbArticle[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    sortBy: 'relevance'
  });
  const [activeFilters, setActiveFilters] = useState<{ [key: string]: any }>({});

  // Initialize from URL params
  useEffect(() => {
    const query = searchParams.get('q') || '';
    const categoryId = searchParams.get('category') || '';
    const sortBy = searchParams.get('sort') as SearchFilters['sortBy'] || 'relevance';

    setSearchQuery(query);
    setSearchFilters({
      categoryId: categoryId || undefined,
      sortBy
    });
    
    if (categoryId) {
      setActiveFilters(prev => ({ ...prev, category: categoryId }));
    }
  }, [searchParams]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchFilters]);

  const loadInitialData = async () => {
    try {
      setLoadingInitial(true);
      
      const [categoriesRes, popularRes, recentRes] = await Promise.all([
        knowledgeBaseApi.getCategories(),
        knowledgeBaseApi.getPopularArticles(6),
        knowledgeBaseApi.getRecentArticles(6)
      ]);

      setCategories(categoriesRes.data);
      setPopularArticles(popularRes.data);
      setRecentArticles(recentRes.data);
      
      // Set featured articles as top 3 popular articles
      setFeaturedArticles(popularRes.data.slice(0, 3));
      
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoadingInitial(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        setLoading(true);
        const response = await knowledgeBaseApi.searchArticles({
          q: query,
          categoryId: searchFilters.categoryId,
          sortBy: searchFilters.sortBy,
          limit: 12
        });
        
        setSearchResults(response.data.articles);
      } catch (error) {
        console.error('Error searching articles:', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [searchFilters]
  );

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    
    // Update URL
    if (query) {
      setSearchParams(prev => {
        prev.set('q', query);
        return prev;
      });
    } else {
      setSearchParams(prev => {
        prev.delete('q');
        return prev;
      });
    }
  };

  const handleCategoryFilter = (categoryId: string) => {
    const newFilters = { ...searchFilters };
    const newActiveFilters = { ...activeFilters };
    
    if (searchFilters.categoryId === categoryId) {
      // Remove filter
      delete newFilters.categoryId;
      delete newActiveFilters.category;
      setSearchParams(prev => {
        prev.delete('category');
        return prev;
      });
    } else {
      // Add filter
      newFilters.categoryId = categoryId;
      newActiveFilters.category = categoryId;
      setSearchParams(prev => {
        prev.set('category', categoryId);
        return prev;
      });
    }
    
    setSearchFilters(newFilters);
    setActiveFilters(newActiveFilters);
  };

  const handleSortChange = (sortBy: SearchFilters['sortBy']) => {
    setSearchFilters(prev => ({ ...prev, sortBy }));
    setSearchParams(prev => {
      if (sortBy && sortBy !== 'relevance') {
        prev.set('sort', sortBy);
      } else {
        prev.delete('sort');
      }
      return prev;
    });
  };

  const clearFilters = () => {
    setSearchFilters({ sortBy: 'relevance' });
    setActiveFilters({});
    setSearchParams({});
    setSearchQuery('');
  };

  const handleArticleClick = (articleId: string) => {
    // Increment view count
    knowledgeBaseApi.incrementViewCount(articleId).catch(console.error);
    navigate(`/portal/knowledge-base/${articleId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getCategoryById = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId);
  };

  const renderArticleCard = (article: KbArticle, showCategory: boolean = true) => (
    <Card 
      key={article.id}
      sx={{ 
        height: '100%',
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[6]
        }
      }}
    >
      <CardActionArea 
        onClick={() => handleArticleClick(article.id)}
        sx={{ height: '100%', p: 2 }}
      >
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
            <ArticleIcon sx={{ mr: 1, color: 'text.secondary', mt: 0.5 }} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h6" component="h3" sx={{ 
                fontSize: '1rem',
                fontWeight: 600,
                mb: 1,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {article.title}
              </Typography>

              {showCategory && article.category && (
                <Chip
                  label={article.category.name}
                  size="small"
                  variant="outlined"
                  sx={{ mb: 1 }}
                  icon={<CategoryIcon />}
                />
              )}

              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  mb: 2
                }}
              >
                {article.summary || article.content?.substring(0, 150) + '...'}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ViewIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {article.viewCount || 0}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LikeIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {article.helpfulCount || 0}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(article.updatedAt)}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );

  const renderSkeleton = () => (
    <Grid container spacing={2}>
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <Grid item xs={12} sm={6} md={4} key={item}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="80%" height={24} />
              <Skeleton variant="text" width="60%" height={20} sx={{ mt: 1 }} />
              <Skeleton variant="text" width="100%" height={60} sx={{ mt: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                <Skeleton variant="text" width="30%" height={16} />
                <Skeleton variant="text" width="25%" height={16} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  if (loadingInitial) {
    return (
      <Box>
        <Skeleton variant="text" width="60%" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={56} sx={{ mb: 4 }} />
        {renderSkeleton()}
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          📚 База знања
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Претражите чланке, решења и упутства за најчешће проблеме
        </Typography>
      </Box>

      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <TextField
          fullWidth
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Претражите чланке, решења и упутства..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton onClick={() => setSearchQuery('')} size="small">
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />

        {/* Active Filters */}
        {Object.keys(activeFilters).length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Активни филтери:
            </Typography>
            {activeFilters.category && (
              <Chip
                label={getCategoryById(activeFilters.category)?.name}
                onDelete={() => handleCategoryFilter(activeFilters.category)}
                size="small"
                color="primary"
              />
            )}
            <Button size="small" onClick={clearFilters}>
              Очисти све
            </Button>
          </Box>
        )}

        {/* Sort Options */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', mr: 1 }}>
            Сортирај по:
          </Typography>
          {[
            { value: 'relevance', label: 'Релевантности' },
            { value: 'date', label: 'Датуму' },
            { value: 'popularity', label: 'Популарности' },
            { value: 'title', label: 'Називу' }
          ].map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              onClick={() => handleSortChange(option.value as SearchFilters['sortBy'])}
              color={searchFilters.sortBy === option.value ? 'primary' : 'default'}
              variant={searchFilters.sortBy === option.value ? 'filled' : 'outlined'}
              size="small"
            />
          ))}
        </Box>
      </Paper>

      {/* Search Results */}
      {searchQuery && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Резултати претраге за "{searchQuery}" 
            {!loading && searchResults.length > 0 && (
              <Typography component="span" color="text.secondary">
                ({searchResults.length} резултата)
              </Typography>
            )}
          </Typography>
          
          {loading ? (
            renderSkeleton()
          ) : searchResults.length > 0 ? (
            <Grid container spacing={2}>
              {searchResults.map((article) => (
                <Grid item xs={12} sm={6} md={4} key={article.id}>
                  {renderArticleCard(article)}
                </Grid>
              ))}
            </Grid>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography>
                Нема резултата за вашу претрагу. Покушајте са другачијим кључним речима или прегледајте популарне чланке испод.
              </Typography>
            </Alert>
          )}
        </Box>
      )}

      {/* Main Content when no search */}
      {!searchQuery && (
        <Grid container spacing={4}>
          {/* Categories */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <CategoryIcon sx={{ mr: 1 }} />
                  Категорије
                </Typography>
                <List dense>
                  {categories.map((category) => (
                    <ListItem
                      key={category.id}
                      button
                      onClick={() => handleCategoryFilter(category.id)}
                      selected={searchFilters.categoryId === category.id}
                      sx={{ borderRadius: 1, mb: 0.5 }}
                    >
                      <ListItemIcon>
                        {category.icon ? (
                          <span style={{ fontSize: '1.2rem' }}>{category.icon}</span>
                        ) : (
                          <CategoryIcon />
                        )}
                      </ListItemIcon>
                      <ListItemText 
                        primary={category.name}
                        secondary={category.articleCount ? `${category.articleCount} чланака` : ''}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Featured & Popular Articles */}
          <Grid item xs={12} md={9}>
            {/* Featured Articles */}
            {featuredArticles.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <PopularIcon sx={{ mr: 1, color: 'warning.main' }} />
                  Издвојени чланци
                </Typography>
                <Grid container spacing={2}>
                  {featuredArticles.map((article) => (
                    <Grid item xs={12} sm={6} md={4} key={article.id}>
                      {renderArticleCard(article)}
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            <Grid container spacing={3}>
              {/* Popular Articles */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrendingIcon sx={{ mr: 1, color: 'success.main' }} />
                  Популарни чланци
                </Typography>
                {popularArticles.length > 0 ? (
                  <Grid container spacing={2}>
                    {popularArticles.slice(3).map((article) => (
                      <Grid item xs={12} key={article.id}>
                        <Card variant="outlined">
                          <CardActionArea onClick={() => handleArticleClick(article.id)}>
                            <CardContent sx={{ py: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <ArticleIcon sx={{ mr: 2, color: 'text.secondary' }} />
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                  <Typography variant="subtitle2" noWrap>
                                    {article.title}
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">
                                      <ViewIcon sx={{ fontSize: 12, mr: 0.5 }} />
                                      {article.viewCount}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      <LikeIcon sx={{ fontSize: 12, mr: 0.5 }} />
                                      {article.helpfulCount}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Нема популарних чланака за приказ.
                  </Typography>
                )}
              </Grid>

              {/* Recent Articles */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <RecentIcon sx={{ mr: 1, color: 'info.main' }} />
                  Најновији чланци
                </Typography>
                {recentArticles.length > 0 ? (
                  <Grid container spacing={2}>
                    {recentArticles.map((article) => (
                      <Grid item xs={12} key={article.id}>
                        <Card variant="outlined">
                          <CardActionArea onClick={() => handleArticleClick(article.id)}>
                            <CardContent sx={{ py: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <ArticleIcon sx={{ mr: 2, color: 'text.secondary' }} />
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                  <Typography variant="subtitle2" noWrap>
                                    {article.title}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatDate(article.updatedAt)}
                                  </Typography>
                                </Box>
                              </Box>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Нема најновијих чланака за приказ.
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default PortalKnowledgeBasePage; 