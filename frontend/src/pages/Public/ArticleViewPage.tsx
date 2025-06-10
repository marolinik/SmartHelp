import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Divider,
  Paper,
  Container,
  Breadcrumbs,
  Link,
  Avatar,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Rating,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Fab,
  Tooltip
} from '@mui/material';
import {
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Share as ShareIcon,
  Print as PrintIcon,
  Bookmark as BookmarkIcon,
  Article as ArticleIcon,
  Category as CategoryIcon,
  Schedule as TimeIcon,
  Visibility as ViewIcon,
  NavigateNext as NavigateNextIcon,
  Home as HomeIcon,
  ArrowUpward as ScrollTopIcon,
  Feedback as FeedbackIcon,
  Person as AuthorIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface KbArticle {
  id: string;
  title: string;
  summary?: string;
  content: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    icon?: string;
  };
  tags?: string[];
  author?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  metaKeywords?: string;
}

interface RelatedArticle {
  id: string;
  title: string;
  summary?: string;
  category?: {
    name: string;
    icon?: string;
  };
  viewCount: number;
}

const ArticleViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [article, setArticle] = useState<KbArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [userFeedback, setUserFeedback] = useState<{
    isHelpful?: boolean;
    comment?: string;
    rating?: number;
  }>({});
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<number | null>(5);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Учитај чланак
  const fetchArticle = async () => {
    if (!id) return;

    try {
      setLoading(true);
      
      // Инкрементирај број прегледа
      const response = await api.get(`/kb/articles/${id}?incrementView=true`);
      
      if (response.data.success) {
        setArticle(response.data.data);
        
        // Учитај сродне чланке
        if (response.data.data.categoryId) {
          fetchRelatedArticles(response.data.data.categoryId, id);
        }
      } else {
        navigate('/knowledge-base');
      }
    } catch (error: any) {
      console.error('Грешка при учитавању чланка:', error);
      if (error.response?.status === 404) {
        navigate('/knowledge-base');
      }
    } finally {
      setLoading(false);
    }
  };

  // Учитај сродне чланке
  const fetchRelatedArticles = async (categoryId: string, currentArticleId: string) => {
    try {
      const response = await api.get(`/kb/articles?categoryId=${categoryId}&limit=5&status=published`);
      
      if (response.data.success) {
        const filtered = response.data.data.articles
          .filter((art: RelatedArticle) => art.id !== currentArticleId)
          .slice(0, 4);
        setRelatedArticles(filtered);
      }
    } catch (error) {
      console.error('Грешка при учитавању сродних чланака:', error);
    }
  };

  // Пошаљи feedback
  const submitFeedback = async (isHelpful: boolean, comment?: string, rating?: number) => {
    if (!article) return;

    try {
      await api.post(`/kb/articles/${article.id}/feedback`, {
        isHelpful,
        comment: comment || undefined,
        rating: rating || undefined
      });

      // Ажурирај локални count
      setArticle(prev => prev ? {
        ...prev,
        helpfulCount: isHelpful ? prev.helpfulCount + 1 : prev.helpfulCount,
        notHelpfulCount: !isHelpful ? (prev.notHelpfulCount || 0) + 1 : (prev.notHelpfulCount || 0)
      } : null);

      setUserFeedback({ isHelpful, comment, rating });
      setFeedbackDialogOpen(false);
      
    } catch (error) {
      console.error('Грешка при слању feedback-а:', error);
    }
  };

  // Подели чланак
  const shareArticle = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: article?.title,
          text: article?.summary,
          url: url
        });
      } catch (error) {
        // Fallback на копирање
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  // Копирај у clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Овде би требало приказати toast поруку
      console.log('Линк је копиран у clipboard');
    });
  };

  // Штампај чланак  
  const printArticle = () => {
    window.print();
  };

  // Scroll to top
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle scroll за показивање scroll to top дугмета
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Учитавам чланак...
        </Typography>
      </Box>
    );
  }

  if (!article) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          Чланак није пронађен или није доступан.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs 
        separator={<NavigateNextIcon fontSize="small" />} 
        sx={{ mb: 3 }}
      >
        <Link 
          color="inherit" 
          href="/knowledge-base"
          onClick={(e) => {
            e.preventDefault();
            navigate('/knowledge-base');
          }}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          База знања
        </Link>
        
        {article.category && (
          <Link
            color="inherit"
            href={`/knowledge-base?category=${article.categoryId}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/knowledge-base?category=${article.categoryId}`);
            }}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            {article.category.icon && (
              <span style={{ fontSize: '1rem' }}>{article.category.icon}</span>
            )}
            {article.category.name}
          </Link>
        )}
        
        <Typography color="text.primary" noWrap sx={{ maxWidth: 300 }}>
          {article.title}
        </Typography>
      </Breadcrumbs>

      <Grid container spacing={4}>
        {/* Главни садржај */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 4 }}>
            {/* Заглавље чланка */}
            <Box mb={4}>
              <Typography variant="h3" component="h1" gutterBottom>
                {article.title}
              </Typography>
              
              {article.summary && (
                <Typography variant="h6" color="text.secondary" paragraph>
                  {article.summary}
                </Typography>
              )}

              {/* Мета информације */}
              <Box display="flex" flexWrap="wrap" alignItems="center" gap={2} mb={3}>
                {article.author && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <AuthorIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {article.author.firstName} {article.author.lastName}
                    </Typography>
                  </Box>
                )}
                
                <Box display="flex" alignItems="center" gap={1}>
                  <TimeIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {format(new Date(article.updatedAt), 'dd. MMMM yyyy.', { locale: sr })}
                  </Typography>
                </Box>
                
                <Box display="flex" alignItems="center" gap={1}>
                  <ViewIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {article.viewCount} прегледа
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1}>
                  <ThumbUpIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {article.helpfulCount} корисно
                  </Typography>
                </Box>
              </Box>

              {/* Тагови */}
              {article.tags && article.tags.length > 0 && (
                <Box display="flex" flexWrap="wrap" gap={1} mb={3}>
                  {article.tags.map((tag, index) => (
                    <Chip 
                      key={index}
                      label={tag} 
                      size="small" 
                      color="primary"
                      variant="outlined"
                      onClick={() => navigate(`/knowledge-base?q=${encodeURIComponent(tag)}`)}
                    />
                  ))}
                </Box>
              )}

              {/* Акције */}
              <Box display="flex" gap={1} mb={3}>
                <Button
                  variant="outlined"
                  startIcon={<ShareIcon />}
                  onClick={shareArticle}
                  size="small"
                >
                  Подели
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={printArticle}
                  size="small"
                >
                  Штампај
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<BookmarkIcon />}
                  size="small"
                >
                  Сачувај
                </Button>
              </Box>

              <Divider />
            </Box>

            {/* Садржај чланка */}
            <Box
              dangerouslySetInnerHTML={{ __html: article.content }}
              sx={{
                '& img': { 
                  maxWidth: '100%', 
                  height: 'auto',
                  borderRadius: 1,
                  boxShadow: 1,
                  my: 2
                },
                '& blockquote': { 
                  borderLeft: '4px solid',
                  borderColor: 'primary.main',
                  paddingLeft: 2, 
                  marginLeft: 0,
                  marginY: 2,
                  fontStyle: 'italic',
                  backgroundColor: 'action.hover',
                  padding: 2,
                  borderRadius: 1
                },
                '& pre': {
                  backgroundColor: 'grey.100',
                  padding: 2,
                  borderRadius: 1,
                  overflow: 'auto'
                },
                '& code': {
                  backgroundColor: 'grey.100',
                  padding: '2px 4px',
                  borderRadius: 0.5,
                  fontSize: '0.9em'
                },
                '& h1, & h2, & h3': {
                  marginTop: 3,
                  marginBottom: 1
                },
                '& p': {
                  marginBottom: 2,
                  lineHeight: 1.7
                },
                '& ul, & ol': {
                  marginLeft: 2,
                  marginBottom: 2
                },
                '& li': {
                  marginBottom: 0.5
                }
              }}
            />

            <Divider sx={{ my: 4 }} />

            {/* Feedback секција */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Да ли вам је овај чланак био користан?
              </Typography>
              
              {userFeedback.isHelpful !== undefined ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Хвала вам на повратној информацији! 
                  {userFeedback.isHelpful ? ' Драго нам је да вам је чланак помогао.' : ' Ваше мишљење нам помаже да побољшамо садржај.'}
                </Alert>
              ) : (
                <Box display="flex" gap={2} mb={2}>
                  <Button
                    variant="contained"
                    startIcon={<ThumbUpIcon />}
                    onClick={() => submitFeedback(true)}
                    color="success"
                  >
                    Да, корисно је
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<ThumbDownIcon />}
                    onClick={() => setFeedbackDialogOpen(true)}
                    color="warning"
                  >
                    Није било корисно
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<FeedbackIcon />}
                    onClick={() => setFeedbackDialogOpen(true)}
                  >
                    Оставите коментар
                  </Button>
                </Box>
              )}

              <Typography variant="body2" color="text.secondary">
                {article.helpfulCount} од {article.helpfulCount + (article.notHelpfulCount || 0)} корисника сматра да је овај чланак користан.
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Сајдбар */}
        <Grid item xs={12} lg={4}>
          {/* Сродни чланци */}
          {relatedArticles.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                  <ArticleIcon color="primary" />
                  Сродни чланци
                </Typography>
                <List dense>
                  {relatedArticles.map((relatedArticle) => (
                    <ListItem 
                      key={relatedArticle.id}
                      button
                      onClick={() => navigate(`/knowledge-base/article/${relatedArticle.id}`)}
                      sx={{ borderRadius: 1, mb: 1 }}
                    >
                      <ListItemIcon>
                        <ArticleIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={relatedArticle.title}
                        secondary={
                          <Box>
                            {relatedArticle.summary && (
                              <Typography variant="caption" display="block">
                                {relatedArticle.summary.substring(0, 80)}...
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {relatedArticle.viewCount} прегледа
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Навигација */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Навигација
              </Typography>
              <List dense>
                <ListItem 
                  button 
                  onClick={() => navigate('/knowledge-base')}
                >
                  <ListItemIcon>
                    <HomeIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Назад на базу знања" />
                </ListItem>
                
                {article.category && (
                  <ListItem 
                    button 
                    onClick={() => navigate(`/knowledge-base?category=${article.categoryId}`)}
                  >
                    <ListItemIcon>
                      <CategoryIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`Више из категорије "${article.category.name}"`}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onClose={() => setFeedbackDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Повратна информација</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Оцените корисност чланка:
              </Typography>
              <Rating
                value={feedbackRating}
                onChange={(event, newValue) => setFeedbackRating(newValue)}
                size="large"
              />
            </Box>
            
            <TextField
              label="Коментар (опционо)"
              multiline
              rows={4}
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Молимо вас да нам кажете како можемо побољшати овај чланак..."
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedbackDialogOpen(false)}>
            Откажи
          </Button>
          <Button 
            onClick={() => submitFeedback(false, feedbackComment, feedbackRating || undefined)}
            variant="contained"
          >
            Пошаљи повратну информацију
          </Button>
        </DialogActions>
      </Dialog>

      {/* Scroll to top дугме */}
      {showScrollTop && (
        <Fab
          color="primary"
          size="small"
          onClick={scrollToTop}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000
          }}
        >
          <ScrollTopIcon />
        </Fab>
      )}
    </Container>
  );
};

export default ArticleViewPage; 