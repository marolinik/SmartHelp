import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SlaStatus, SlaInfo } from '../../components/SlaStatus';

// Types
interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
  };
  requester: {
    id: string;
    displayName: string;
    email: string;
    department?: string;
  };
  assignee?: {
    id: string;
    displayName: string;
    email: string;
    department?: string;
  };
  createdAt: string;
  updatedAt: string;
  slaDueDate?: string;
  slaResponseDue?: string;
  slaResolutionDue?: string;
  slaStatus?: 'on_track' | 'warning' | 'breached';
  firstResponseAt?: string;
  resolvedAt?: string;
}

interface TicketsResponse {
  tickets: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface StatusOption {
  value: string;
  label: string;
  color: string;
}

interface PriorityOption {
  value: string;
  label: string;
}

const TicketsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Options
  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [priorities, setPriorities] = useState<PriorityOption[]>([]);

  // SLA Information
  const [slaData, setSlaData] = useState<Record<string, SlaInfo>>({});

  // API calls
  const fetchTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (categoryFilter) params.append('categoryId', categoryFilter);

      const response = await fetch(`/api/tickets?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Грешка при учитавању тикета');
      }

      const data: { success: boolean; data: TicketsResponse } = await response.json();
      
      if (data.success) {
        setTickets(data.data.tickets);
        setTotalCount(data.data.pagination.total);
        
        // Учитај SLA информације за сваки тикет
        await fetchSlaForTickets(data.data.tickets);
      } else {
        throw new Error('Неуспешан одговор сервера');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Непозната грешка');
    } finally {
      setLoading(false);
    }
  };

  const fetchSlaForTickets = async (tickets: Ticket[]) => {
    const token = localStorage.getItem('token');
    const slaPromises = tickets.map(async (ticket) => {
      try {
        const response = await fetch(`/api/sla/calculate/${ticket.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            return {
              ticketId: ticket.id,
              slaInfo: {
                responseTimeHours: data.data.responseTimeHours || 0,
                resolutionTimeHours: data.data.resolutionTimeHours || 0,
                responseDueDate: ticket.slaResponseDue || data.data.responseDueDate,
                resolutionDueDate: ticket.slaResolutionDue || data.data.resolutionDueDate,
                slaStatus: ticket.slaStatus || data.data.slaStatus || 'on_track',
                calculatedAt: data.data.calculatedAt
              } as SlaInfo
            };
          }
        }
        return null;
      } catch (error) {
        console.error(`Грешка при учитавању SLA за тикет ${ticket.ticketNumber}:`, error);
        return null;
      }
    });

    const slaResults = await Promise.all(slaPromises);
    const newSlaData: Record<string, SlaInfo> = {};
    
    slaResults.forEach((result) => {
      if (result) {
        newSlaData[result.ticketId] = result.slaInfo;
      }
    });

    setSlaData(newSlaData);
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tickets/categories', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCategories(data.data);
        }
      }
    } catch (err) {
      console.error('Грешка при учитавању категорија:', err);
    }
  };

  const fetchStatuses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tickets/workflow/statuses', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStatuses(data.data);
        }
      }
    } catch (err) {
      console.error('Грешка при учитавању статуса:', err);
    }
  };

  const fetchPriorities = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tickets/workflow/priorities', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPriorities(data.data);
        }
      }
    } catch (err) {
      console.error('Грешка при учитавању приоритета:', err);
    }
  };

  // Effects
  useEffect(() => {
    fetchCategories();
    fetchStatuses();
    fetchPriorities();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [page, rowsPerPage, searchTerm, statusFilter, priorityFilter, categoryFilter]);

  // Handlers
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = () => {
    setPage(0);
    fetchTickets();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setPage(0);
  };

  const getStatusChip = (status: string) => {
    const statusOption = statuses.find(s => s.value === status);
    return (
      <Chip
        label={statusOption?.label || status}
        size="small"
        sx={{
          backgroundColor: statusOption?.color || '#757575',
          color: 'white',
          fontWeight: 'bold'
        }}
      />
    );
  };

  const getPriorityChip = (priority: string) => {
    const priorityOption = priorities.find(p => p.value === priority);
    const colors = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
      critical: '#9C27B0'
    };
    
    return (
      <Chip
        label={priorityOption?.label || priority}
        size="small"
        variant="outlined"
        sx={{
          borderColor: colors[priority as keyof typeof colors] || '#757575',
          color: colors[priority as keyof typeof colors] || '#757575',
        }}
      />
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sr-RS', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && tickets.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Тикети
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/tickets/create')}
        >
          Нови тикет
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Филтери
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Претрага"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Број тикета, наслов, опис..."
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={handleSearch}>
                      <SearchIcon />
                    </IconButton>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  value={statusFilter}
                  label="Статус"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="">Сви</MenuItem>
                  {statuses.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Приоритет</InputLabel>
                <Select
                  value={priorityFilter}
                  label="Приоритет"
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <MenuItem value="">Сви</MenuItem>
                  {priorities.map((priority) => (
                    <MenuItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Категорија</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Категорија"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="">Све</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                onClick={clearFilters}
                sx={{ mr: 1 }}
              >
                Обриши филтере
              </Button>
              <Button
                variant="contained"
                onClick={handleSearch}
              >
                Примени
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Број тикета</TableCell>
                <TableCell>Наслов</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Приоритет</TableCell>
                <TableCell>Категорија</TableCell>
                <TableCell>SLA Статус</TableCell>
                <TableCell>Подносилац</TableCell>
                <TableCell>Додељено</TableCell>
                <TableCell>Креирано</TableCell>
                <TableCell>Акције</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {ticket.ticketNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {ticket.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getStatusChip(ticket.status)}
                  </TableCell>
                  <TableCell>
                    {getPriorityChip(ticket.priority)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {ticket.category?.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <SlaStatus
                      slaInfo={slaData[ticket.id] || null}
                      ticketStatus={ticket.status}
                      firstResponseAt={ticket.firstResponseAt || null}
                      resolvedAt={ticket.resolvedAt || null}
                      compact={true}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={ticket.requester.email}>
                      <Typography variant="body2">
                        {ticket.requester.displayName}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {ticket.assignee?.displayName || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(ticket.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Прикажи детаље">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Уреди">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/tickets/${ticket.id}/edit`)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {tickets.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="textSecondary">
                      Нема тикета за приказ
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 20, 50]}
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
      </Paper>
    </Box>
  );
};

export default TicketsPage; 