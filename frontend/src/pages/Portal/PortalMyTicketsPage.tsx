import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Menu,
  Skeleton,
  Alert,
  Paper,
  Divider,
  Badge,
  Tooltip,
  useTheme,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  ConfirmationNumber as TicketIcon,
  Schedule as PendingIcon,
  Engineering as InProgressIcon,
  CheckCircle as DoneIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  MoreVert as MoreVertIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Comment as CommentIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { RootState } from '../../store/store';
import { ticketApi, Ticket, TicketFilters } from '../../services/ticketApi';

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

const PortalMyTicketsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useSelector((state: RootState) => state.auth.user);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0
  });

  // Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // UI state
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    loadTickets();
  }, [user, searchQuery, statusFilter, priorityFilter, sortBy, sortOrder]);

  const loadTickets = async (showRefresh: boolean = false) => {
    if (!user) return;

    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const filters: TicketFilters = {
        customer: user.id,
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        sortBy: sortBy as any,
        sortOrder,
        limit: 50
      };

      const response = await ticketApi.getTickets(filters);
      const ticketList = response.data.tickets || [];
      
      setTickets(ticketList);
      
      // Calculate stats
      const newStats = ticketList.reduce((acc, ticket) => {
        acc.total++;
        switch (ticket.status) {
          case 'open':
          case 'pending':
            acc.open++;
            break;
          case 'in_progress':
          case 'assigned':
            acc.inProgress++;
            break;
          case 'resolved':
            acc.resolved++;
            break;
          case 'closed':
            acc.closed++;
            break;
        }
        return acc;
      }, { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 });

      setStats(newStats);
      
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadTickets(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  const handleTicketClick = (ticketId: string) => {
    navigate(`/portal/tickets/${ticketId}`);
  };

  const handleCreateTicket = () => {
    navigate('/portal/ticket/new');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
      case 'pending':
        return <PendingIcon sx={{ fontSize: 16 }} />;
      case 'in_progress':
      case 'assigned':
        return <InProgressIcon sx={{ fontSize: 16 }} />;
      case 'resolved':
        return <DoneIcon sx={{ fontSize: 16 }} />;
      case 'closed':
        return <DoneIcon sx={{ fontSize: 16 }} />;
      default:
        return <InfoIcon sx={{ fontSize: 16 }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'pending':
        return 'warning';
      case 'in_progress':
      case 'assigned':
        return 'info';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
      case 'urgent':
        return <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />;
      case 'medium':
        return <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
      case 'low':
        return <InfoIcon sx={{ fontSize: 16, color: 'info.main' }} />;
      default:
        return <InfoIcon sx={{ fontSize: 16 }} />;
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

  const getStatusLabel = (status: string) => {
    const statusLabels: { [key: string]: string } = {
      'open': 'Отворен',
      'pending': 'На чекању',
      'in_progress': 'У обради',
      'assigned': 'Додељен',
      'resolved': 'Решен',
      'closed': 'Затворен'
    };
    return statusLabels[status] || status;
  };

  const getPriorityLabel = (priority: string) => {
    const priorityLabels: { [key: string]: string } = {
      'low': 'Низак',
      'medium': 'Средњи',
      'high': 'Висок',
      'urgent': 'Хитан'
    };
    return priorityLabels[priority] || priority;
  };

  const renderTicketCard = (ticket: Ticket) => (
    <Card 
      key={ticket.id}
      sx={{ 
        mb: 2,
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: theme.shadows[4]
        }
      }}
    >
      <CardActionArea onClick={() => handleTicketClick(ticket.id)}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" component="h3" sx={{ 
                  fontSize: '1rem',
                  fontWeight: 600,
                  mr: 2,
                  minWidth: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  #{ticket.ticketNumber}
                </Typography>
                
                <Chip
                  icon={getStatusIcon(ticket.status)}
                  label={getStatusLabel(ticket.status)}
                  color={getStatusColor(ticket.status) as any}
                  size="small"
                  sx={{ mr: 1 }}
                />
                
                <Chip
                  icon={getPriorityIcon(ticket.priority)}
                  label={getPriorityLabel(ticket.priority)}
                  variant="outlined"
                  size="small"
                />
              </Box>

              <Typography 
                variant="h6" 
                component="h2" 
                sx={{ 
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  mb: 1,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {ticket.subject}
              </Typography>

              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  mb: 2
                }}
              >
                {ticket.description}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {ticket.category && (
                    <Typography variant="caption" color="text.secondary">
                      📁 {ticket.category.name}
                    </Typography>
                  )}
                  {ticket.assignedTo && (
                    <Typography variant="caption" color="text.secondary">
                      👤 {ticket.assignedTo.displayName}
                    </Typography>
                  )}
                </Box>
                
                <Typography variant="caption" color="text.secondary">
                  {formatDate(ticket.createdAt)}
                </Typography>
              </Box>
            </Box>

            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                // Handle ticket menu
              }}
              sx={{ ml: 1 }}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );

  const renderStatsCard = (title: string, count: number, icon: React.ReactNode, color: string) => (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ color, mb: 1 }}>
            {icon}
          </Box>
          <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
            {count}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  const renderSkeleton = () => (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[1, 2, 3, 4].map((item) => (
          <Grid item xs={6} sm={3} key={item}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Skeleton variant="circular" width={40} height={40} sx={{ mx: 'auto', mb: 1 }} />
                <Skeleton variant="text" width="60%" height={32} sx={{ mx: 'auto', mb: 0.5 }} />
                <Skeleton variant="text" width="80%" height={20} sx={{ mx: 'auto' }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {[1, 2, 3, 4, 5].map((item) => (
        <Card key={item} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width="30%" height={24} sx={{ mb: 1 }} />
                <Skeleton variant="text" width="80%" height={28} sx={{ mb: 1 }} />
                <Skeleton variant="text" width="100%" height={40} sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton variant="text" width="40%" height={16} />
                  <Skeleton variant="text" width="25%" height={16} />
                </Box>
              </Box>
              <Skeleton variant="circular" width={24} height={24} sx={{ ml: 1 }} />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  if (loading) {
    return renderSkeleton();
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            🎫 Моји тикети
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Преглед и управљање вашим захтевима за подршку
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateTicket}
          sx={{ height: 'fit-content' }}
        >
          Нови тикет
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          {renderStatsCard('Укупно', stats.total, <TicketIcon />, theme.palette.primary.main)}
        </Grid>
        <Grid item xs={6} sm={3}>
          {renderStatsCard('Отворени', stats.open, <PendingIcon />, theme.palette.warning.main)}
        </Grid>
        <Grid item xs={6} sm={3}>
          {renderStatsCard('У обради', stats.inProgress, <InProgressIcon />, theme.palette.info.main)}
        </Grid>
        <Grid item xs={6} sm={3}>
          {renderStatsCard('Решени', stats.resolved, <DoneIcon />, theme.palette.success.main)}
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            placeholder="Претражите тикете..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flexGrow: 1 }}
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
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Статус</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Статус"
            >
              <MenuItem value="">Сви</MenuItem>
              <MenuItem value="open">Отворени</MenuItem>
              <MenuItem value="in_progress">У обради</MenuItem>
              <MenuItem value="resolved">Решени</MenuItem>
              <MenuItem value="closed">Затворени</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Приоритет</InputLabel>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              label="Приоритет"
            >
              <MenuItem value="">Сви</MenuItem>
              <MenuItem value="low">Низак</MenuItem>
              <MenuItem value="medium">Средњи</MenuItem>
              <MenuItem value="high">Висок</MenuItem>
              <MenuItem value="urgent">Хитан</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Сортирај по</InputLabel>
            <Select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order as 'asc' | 'desc');
              }}
              label="Сортирај по"
            >
              <MenuItem value="createdAt-desc">Најновији</MenuItem>
              <MenuItem value="createdAt-asc">Најстарији</MenuItem>
              <MenuItem value="subject-asc">Наслов А-Ш</MenuItem>
              <MenuItem value="subject-desc">Наслов Ш-А</MenuItem>
              <MenuItem value="priority-desc">Приоритет ↓</MenuItem>
              <MenuItem value="status-asc">Статус ↑</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title="Освежи">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <RefreshIcon sx={{ 
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }} />
            </IconButton>
          </Tooltip>

          {(searchQuery || statusFilter || priorityFilter || sortBy !== 'createdAt' || sortOrder !== 'desc') && (
            <Button onClick={clearFilters} size="small">
              Очисти филтере
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Tickets List */}
      {tickets.length > 0 ? (
        <Box>
          {tickets.map(renderTicketCard)}
        </Box>
      ) : (
        <Alert severity="info" sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" gutterBottom>
            Нема тикета за приказ
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {searchQuery || statusFilter || priorityFilter
              ? 'Промените филтере да видите више тикета или креирајте нови тикет.'
              : 'Још увек нисте креирали ниједан тикет. Креирајте свој први тикет за подршку!'
            }
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateTicket}
          >
            Креирај тикет
          </Button>
        </Alert>
      )}
    </Box>
  );
};

export default PortalMyTicketsPage; 