import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  Button,
  Divider,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Stack,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { SlaStatus, SlaInfo } from '../../components/SlaStatus';

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
    description?: string;
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
  resolvedAt?: string;
  firstResponseAt?: string;
  slaResponseDue?: string;
  slaResolutionDue?: string;
  slaStatus?: 'on_track' | 'warning' | 'breached';
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

const TicketDetailPage: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [slaInfo, setSlaInfo] = useState<SlaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [priorities, setPriorities] = useState<PriorityOption[]>([]);

  // Учитај детаље тикета
  const fetchTicket = async () => {
    try {
      if (!ticketId) {
        throw new Error('ID тикета није дефинисан');
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tickets/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Грешка при учитавању тикета');
      }

      const data = await response.json();
      if (data.success) {
        setTicket(data.data);
        // Учитај SLA информације
        await fetchSlaInfo(ticketId);
      } else {
        throw new Error('Неуспешан одговор сервера');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Непозната грешка');
    } finally {
      setLoading(false);
    }
  };

  // Учитај SLA информације
  const fetchSlaInfo = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/sla/calculate/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSlaInfo({
            responseTimeHours: data.data.responseTimeHours || 0,
            resolutionTimeHours: data.data.resolutionTimeHours || 0,
            responseDueDate: data.data.responseDueDate,
            resolutionDueDate: data.data.resolutionDueDate,
            slaStatus: data.data.slaStatus || 'on_track',
            calculatedAt: data.data.calculatedAt
          });
        }
      }
    } catch (error) {
      console.error('Грешка при учитавању SLA информација:', error);
    }
  };

  // Учитај опције статуса и приоритета
  const fetchOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Статуси
      const statusResponse = await fetch('/api/tickets/workflow/statuses', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.success) setStatuses(statusData.data);
      }

      // Приоритети
      const priorityResponse = await fetch('/api/tickets/workflow/priorities', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (priorityResponse.ok) {
        const priorityData = await priorityResponse.json();
        if (priorityData.success) setPriorities(priorityData.data);
      }
    } catch (error) {
      console.error('Грешка при учитавању опција:', error);
    }
  };

  useEffect(() => {
    fetchTicket();
    fetchOptions();
  }, [ticketId]);

  const getStatusChip = (status: string) => {
    const statusOption = statuses.find(s => s.value === status);
    return (
      <Chip
        label={statusOption?.label || status}
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !ticket) {
    return (
      <Box>
        <Alert severity="error">
          {error || 'Тикет није пронађен'}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/tickets')}
          sx={{ mt: 2 }}
        >
          Назад на листу
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/tickets')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">
            Тикет {ticket.ticketNumber}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => navigate(`/tickets/${ticket.id}/edit`)}
        >
          Уреди
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Основне информације */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {ticket.title}
            </Typography>
            <Typography variant="body1" paragraph>
              {ticket.description}
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Статус
                </Typography>
                {getStatusChip(ticket.status)}
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Приоритет
                </Typography>
                {getPriorityChip(ticket.priority)}
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Категорија
                </Typography>
                <Typography variant="body2">
                  {ticket.category?.name || '-'}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Креирано
                </Typography>
                <Typography variant="body2">
                  {formatDate(ticket.createdAt)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* SLA Информације - Детаљни приказ */}
          <SlaStatus
            slaInfo={slaInfo}
            ticketStatus={ticket.status}
            firstResponseAt={ticket.firstResponseAt || null}
            resolvedAt={ticket.resolvedAt || null}
            compact={false}
          />
        </Grid>

        {/* Bočna traka */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            {/* Особе */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                  <PersonIcon />
                  Особе
                </Typography>
                
                <Box mb={2}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Подносилац
                  </Typography>
                  <Typography variant="body2">
                    {ticket.requester.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ticket.requester.email}
                  </Typography>
                  {ticket.requester.department && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {ticket.requester.department}
                    </Typography>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Додељено
                  </Typography>
                  {ticket.assignee ? (
                    <>
                      <Typography variant="body2">
                        {ticket.assignee.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ticket.assignee.email}
                      </Typography>
                      {ticket.assignee.department && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {ticket.assignee.department}
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Није додељено
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Временске ознаке */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon />
                  Временске ознаке
                </Typography>
                
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Креирано
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(ticket.createdAt)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Последњи пут ажурирано
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(ticket.updatedAt)}
                    </Typography>
                  </Box>

                  {ticket.firstResponseAt && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Први одзив
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(ticket.firstResponseAt)}
                      </Typography>
                    </Box>
                  )}

                  {ticket.resolvedAt && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Решено
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(ticket.resolvedAt)}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TicketDetailPage; 