import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as TicketIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import api from '../../services/api';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { SerbianFormat } from '../../utils/formatting';

interface DashboardMetrics {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  overdueTickets: number;
  avgResolutionTime: number;
  slaCompliance: number;
  recentTickets: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
  }>;
  ticketsByStatus: Array<{
    name: string;
    count: number;
    color: string;
  }>;
  ticketsByPriority: Array<{
    name: string;
    count: number;
    color: string;
  }>;
  activityTrend: Array<{
    date: string;
    created: number;
    resolved: number;
  }>;
}

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Позив API-ја за dashboard метрике
      const response = await api.get('/tickets/dashboard-metrics');
      
      if (response.data.success) {
        setMetrics(response.data.data);
      } else {
        throw new Error('Неуспешан одговор сервера');
      }
    } catch (err: any) {
      console.error('Грешка при учитавању dashboard података:', err);
      setError('Грешка при учитавању dashboard података');
      
      // Mock подаци за развој
      setMetrics({
        totalTickets: 145,
        openTickets: 23,
        resolvedTickets: 122,
        overdueTickets: 3,
        avgResolutionTime: 4.2,
        slaCompliance: 94.5,
        recentTickets: [
          {
            id: '1',
            ticketNumber: '20250530-0001',
            title: 'Проблем са приступом систему',
            status: 'open',
            priority: 'high',
            createdAt: new Date().toISOString()
          },
          {
            id: '2', 
            ticketNumber: '20250530-0002',
            title: 'Захтев за нови рачунар',
            status: 'in_progress',
            priority: 'medium',
            createdAt: new Date().toISOString()
          }
        ],
        ticketsByStatus: [
          { name: 'Отворени', count: 23, color: '#2196f3' },
          { name: 'У раду', count: 15, color: '#ff9800' },
          { name: 'Решени', count: 122, color: '#4caf50' },
          { name: 'Затворени', count: 85, color: '#9e9e9e' }
        ],
        ticketsByPriority: [
          { name: 'Критични', count: 2, color: '#f44336' },
          { name: 'Високи', count: 8, color: '#ff9800' },
          { name: 'Средњи', count: 25, color: '#2196f3' },
          { name: 'Ниски', count: 12, color: '#4caf50' }
        ],
        activityTrend: [
          { date: '2025-05-24', created: 12, resolved: 8 },
          { date: '2025-05-25', created: 15, resolved: 11 },
          { date: '2025-05-26', created: 9, resolved: 13 },
          { date: '2025-05-27', created: 18, resolved: 14 },
          { date: '2025-05-28', created: 22, resolved: 16 },
          { date: '2025-05-29', created: 11, resolved: 19 },
          { date: '2025-05-30', created: 7, resolved: 12 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'error';
      case 'in_progress': return 'warning';
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

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      'open': 'Отворен',
      'in_progress': 'У раду',
      'resolved': 'Решен',
      'closed': 'Затворен',
      'pending': 'На чекању'
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority: string) => {
    const labels: { [key: string]: string } = {
      'critical': 'Критични',
      'high': 'Високи',
      'medium': 'Средњи',
      'low': 'Ниски'
    };
    return labels[priority] || priority;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !metrics) {
    return (
      <Alert severity="error" action={
        <IconButton onClick={fetchDashboardData}>
          <RefreshIcon />
        </IconButton>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <DashboardIcon />
          Dashboard - PIO Help Desk
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            Добродошли, {user?.displayName}
          </Typography>
          <Tooltip title="Освежи податке">
            <IconButton onClick={fetchDashboardData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error} - Приказани су примери података
        </Alert>
      )}

      {metrics && (
        <>
          {/* Кључне метрике */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h4" color="primary">
                        {metrics.totalTickets}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Укупно тикета
                      </Typography>
                    </Box>
                    <TicketIcon color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h4" color="error">
                        {metrics.openTickets}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Отворени тикети
                      </Typography>
                    </Box>
                    <WarningIcon color="error" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h4" color="success.main">
                        {SerbianFormat.formatPercentage(metrics.slaCompliance)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        SLA усклађеност
                      </Typography>
                    </Box>
                    <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h4" color="info.main">
                        {SerbianFormat.formatDecimal(metrics.avgResolutionTime, 1)}h
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Просечно решавање
                      </Typography>
                    </Box>
                    <ScheduleIcon color="info" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Графици */}
          <Grid container spacing={3} mb={4}>
            {/* Тикети по статусу */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Тикети по статусу
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={metrics.ticketsByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, count }) => `${name}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {metrics.ticketsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Тикети по приоритету */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Тикети по приоритету
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={metrics.ticketsByPriority}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ChartTooltip />
                    <Bar dataKey="count" fill="#1976d2" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Активност и најновији тикети */}
          <Grid container spacing={3}>
            {/* Тренд активности */}
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Тренд активности (задњих 7 дана)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.activityTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'dd.MM', { locale: sr })}
                    />
                    <YAxis />
                    <ChartTooltip
                      labelFormatter={(date) => format(new Date(date), 'dd.MM.yyyy', { locale: sr })}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="created" 
                      stroke="#2196f3" 
                      name="Креирани"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="resolved" 
                      stroke="#4caf50" 
                      name="Решени"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Најновији тикети */}
            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Најновији тикети
                </Typography>
                <List>
                  {metrics.recentTickets.map((ticket) => (
                    <ListItem key={ticket.id} divider>
                      <ListItemIcon>
                        <TicketIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2">
                              #{ticket.ticketNumber}
                            </Typography>
                            <Box display="flex" gap={0.5}>
                              <Chip 
                                label={getStatusLabel(ticket.status)}
                                color={getStatusColor(ticket.status) as any}
                                size="small"
                              />
                              <Chip 
                                label={getPriorityLabel(ticket.priority)}
                                color={getPriorityColor(ticket.priority) as any}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" noWrap>
                              {ticket.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(ticket.createdAt), 'dd.MM.yyyy HH:mm', { locale: sr })}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default DashboardPage; 