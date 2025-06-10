import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Skeleton,
  useTheme,
  Paper,
  Avatar
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as TicketIcon,
  Search as SearchIcon,
  Support as SupportIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Announcement as AnnouncementIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { RootState } from '../../store/store';
import { ticketApi, Ticket } from '../../services/ticketApi';
import QuickLinksSection from '../../components/Portal/QuickLinksSection';

interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  avgResponseTime: string;
  recentTickets: Array<{
    id: string;
    subject: string;
    status: string;
    createdAt: string;
    priority: string;
  }>;
}

const PortalDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load user's tickets and calculate stats
      const response = await ticketApi.getTickets({
        customer: user?.id,
        limit: 5,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      const tickets = response.data.tickets || [];
      const openTickets = tickets.filter((ticket: Ticket) => 
        ['open', 'in_progress', 'pending'].includes(ticket.status)
      );

      setStats({
        totalTickets: response.data.total || 0,
        openTickets: openTickets.length,
        avgResponseTime: '2 сата', // This would come from analytics
        recentTickets: tickets.slice(0, 5).map((ticket: Ticket) => ({
          id: ticket.id,
          subject: ticket.subject,
          status: ticket.status,
          createdAt: ticket.createdAt,
          priority: ticket.priority
        }))
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: t('selfService.dashboard.createTicketAction'),
      description: t('selfService.nav.newTicketDesc'),
      icon: <AddIcon />,
      color: theme.palette.primary.main,
      action: () => navigate('/portal/ticket/new')
    },
    {
      title: t('selfService.dashboard.viewTicketsAction'),
      description: t('selfService.nav.myTicketsDesc'),
      icon: <TicketIcon />,
      color: theme.palette.info.main,
      action: () => navigate('/portal/tickets')
    },
    {
      title: t('selfService.dashboard.searchKbAction'),
      description: t('selfService.nav.knowledgeBaseDesc'),
      icon: <SearchIcon />,
      color: theme.palette.success.main,
      action: () => navigate('/portal/knowledge-base')
    },
    {
      title: t('selfService.dashboard.contactSupportAction'),
      description: 'Директан контакт са тимом за подршку',
      icon: <SupportIcon />,
      color: theme.palette.warning.main,
      action: () => window.open('mailto:support@pio.rs', '_blank')
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'error';
      case 'in_progress': return 'warning';
      case 'pending': return 'info';
      case 'resolved': return 'success';
      case 'closed': return 'default';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width="60%" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="80%" height={24} sx={{ mb: 4 }} />
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('selfService.dashboard.welcome')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('selfService.dashboard.description')}
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Quick Stats */}
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        {t('selfService.dashboard.quickStats')}
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: theme.palette.primary.main, mr: 2 }}>
                  <TicketIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div">
                    {stats?.totalTickets || 0}
                  </Typography>
                  <Typography color="text.secondary">
                    {t('selfService.dashboard.totalTickets')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: theme.palette.warning.main, mr: 2 }}>
                  <TrendingUpIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div">
                    {stats?.openTickets || 0}
                  </Typography>
                  <Typography color="text.secondary">
                    {t('selfService.dashboard.openTickets')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: theme.palette.success.main, mr: 2 }}>
                  <ScheduleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div">
                    {stats?.avgResponseTime || 'N/A'}
                  </Typography>
                  <Typography color="text.secondary">
                    {t('selfService.dashboard.avgResponseTime')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: theme.palette.info.main, mr: 2 }}>
                  <CheckCircleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div">
                    98%
                  </Typography>
                  <Typography color="text.secondary">
                    Задовољство корисника
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('selfService.dashboard.quickActions')}
              </Typography>
              <Grid container spacing={2}>
                {quickActions.map((action, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: action.color,
                          transform: 'translateY(-2px)',
                          boxShadow: theme.shadows[4]
                        }
                      }}
                      onClick={action.action}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                        <Avatar
                          sx={{
                            bgcolor: action.color,
                            mr: 2,
                            width: 40,
                            height: 40
                          }}
                        >
                          {action.icon}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {action.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {action.description}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('selfService.dashboard.recentActivity')}
              </Typography>
              
              {stats?.recentTickets && stats.recentTickets.length > 0 ? (
                <List dense>
                  {stats.recentTickets.map((ticket, index) => (
                    <React.Fragment key={ticket.id}>
                      <ListItem
                        button
                        onClick={() => navigate(`/portal/tickets/${ticket.id}`)}
                        sx={{ px: 0 }}
                      >
                        <ListItemIcon>
                          <TicketIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
                                {ticket.subject}
                              </Typography>
                              <Chip
                                label={t(`status.${ticket.status}`)}
                                size="small"
                                color={getStatusColor(ticket.status) as any}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                              <Chip
                                label={t(`priority.${ticket.priority}`)}
                                size="small"
                                variant="outlined"
                                color={getPriorityColor(ticket.priority) as any}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(ticket.createdAt)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < stats.recentTickets.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Нема недавне активности
                </Typography>
              )}

              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate('/portal/tickets')}
                sx={{ mt: 2 }}
              >
                Прикажи све тикете
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Announcements */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AnnouncementIcon sx={{ mr: 1, color: theme.palette.info.main }} />
            <Typography variant="h6">
              {t('selfService.dashboard.announcements')}
            </Typography>
          </Box>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Планирано одржавање:</strong> Систем ће бити недоступан у недељу 26.01.2025 од 02:00 до 04:00 због редовног одржавања.
            </Typography>
          </Alert>
          
          <Alert severity="success">
            <Typography variant="body2">
              <strong>Нова функционалност:</strong> Сада можете приложити до 10 фајлова по тикету, укључујући видео записе до 50MB.
            </Typography>
          </Alert>
        </CardContent>
      </Card>

      {/* Quick Links Section */}
      <Box sx={{ mt: 4 }}>
        <QuickLinksSection onCreateTicket={(prefillData) => {
          const params = new URLSearchParams();
          Object.entries(prefillData).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              params.set(key, value.join(','));
            } else {
              params.set(key, String(value));
            }
          });
          navigate(`/portal/ticket/new?${params.toString()}`);
        }} />
      </Box>
    </Box>
  );
};

export default PortalDashboardPage; 