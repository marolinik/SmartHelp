import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  HealthAndSafety as HealthIcon,
  Computer as SystemIcon,
  Memory as MemoryIcon,
  Storage as DiskIcon,
  Speed as CpuIcon,
  Email as EmailIcon,
  Storage as DatabaseIcon,
  Wifi as NetworkIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Schedule as UptimeIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { SerbianFormat } from '../../utils/formatting';
import api from '../../services/api';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  responseTime?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  uptime: number;
  timestamp: Date;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
  checks: HealthCheck[];
  metrics: SystemMetrics;
  summary: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
  };
}

const SystemHealthPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<SystemHealth | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<Array<{
    timestamp: string;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  }>>([]);

  const fetchHealthData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(!showLoading);
      setError(null);

      const response = await api.get('/health/detailed');
      
      if (response.data.success) {
        const healthReport = response.data.data;
        setHealthData(healthReport);
        
        // Додај у историју метрика
        const newMetric = {
          timestamp: format(new Date(), 'HH:mm:ss'),
          cpuUsage: healthReport.metrics.cpu.usage,
          memoryUsage: healthReport.metrics.memory.percentage,
          diskUsage: healthReport.metrics.disk.percentage || 0
        };
        
        setMetricsHistory(prev => {
          const updated = [...prev, newMetric];
          return updated.slice(-20); // Задржи последњих 20 тачака
        });
      }
    } catch (err: any) {
      console.error('Грешка при учитавању health података:', err);
      setError('Грешка при учитавању системских података');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    // Аутоматско освежавање сваких 30 секунди
    const interval = setInterval(() => {
      fetchHealthData(false);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckIcon color="success" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'critical': return <ErrorIcon color="error" />;
      default: return <CheckIcon />;
    }
  };

  const getComponentIcon = (name: string) => {
    if (name.includes('База') || name.includes('Database')) return <DatabaseIcon />;
    if (name.includes('Email')) return <EmailIcon />;
    if (name.includes('Меморија') || name.includes('Memory')) return <MemoryIcon />;
    if (name.includes('Диск') || name.includes('Disk')) return <DiskIcon />;
    if (name.includes('WebSocket') || name.includes('API')) return <NetworkIcon />;
    return <SystemIcon />;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}ч ${minutes}м ${remainingSeconds}с`;
    } else if (minutes > 0) {
      return `${minutes}м ${remainingSeconds}с`;
    } else {
      return `${remainingSeconds}с`;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Учитавам системске податке...
        </Typography>
      </Box>
    );
  }

  if (error && !healthData) {
    return (
      <Alert severity="error" action={
        <Button onClick={() => fetchHealthData()}>
          Покушај поново
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <HealthIcon />
          Здравље система
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            Последње ажурирање: {healthData?.timestamp ? format(new Date(healthData.timestamp), 'dd.MM.yyyy HH:mm:ss', { locale: sr }) : 'Непознато'}
          </Typography>
          <Tooltip title="Освежи податке">
            <IconButton onClick={() => fetchHealthData(false)} disabled={refreshing}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && healthData && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error} - Приказани су последње доступни подаци
        </Alert>
      )}

      {healthData && (
        <>
          {/* Општи статус система */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6" color={getStatusColor(healthData.status) + '.main'}>
                        {healthData.status === 'healthy' ? 'Здрав' : 
                         healthData.status === 'warning' ? 'Упозорење' : 'Критично'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Општи статус
                      </Typography>
                    </Box>
                    {getStatusIcon(healthData.status)}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6">
                        {formatUptime(healthData.metrics.uptime)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Време рада
                      </Typography>
                    </Box>
                    <UptimeIcon color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6" color="success.main">
                        {healthData.summary.healthy}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Здрави компоненти
                      </Typography>
                    </Box>
                    <CheckIcon color="success" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6" color="error.main">
                        {healthData.summary.critical}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Критични проблеми
                      </Typography>
                    </Box>
                    <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Системске метрике */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="CPU коришћење" />
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <CpuIcon color="primary" />
                    <Box flexGrow={1}>
                      <Typography variant="h6">
                        {SerbianFormat.formatPercentage(healthData.metrics.cpu.usage)}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={healthData.metrics.cpu.usage}
                        color={healthData.metrics.cpu.usage > 80 ? 'error' : 
                               healthData.metrics.cpu.usage > 60 ? 'warning' : 'primary'}
                      />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Load Average: {healthData.metrics.cpu.loadAverage.map(l => SerbianFormat.formatDecimal(l, 2)).join(', ')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Меморија" />
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <MemoryIcon color="primary" />
                    <Box flexGrow={1}>
                      <Typography variant="h6">
                        {SerbianFormat.formatPercentage(healthData.metrics.memory.percentage)}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={healthData.metrics.memory.percentage}
                        color={healthData.metrics.memory.percentage > 90 ? 'error' : 
                               healthData.metrics.memory.percentage > 75 ? 'warning' : 'primary'}
                      />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {formatBytes(healthData.metrics.memory.used)} / {formatBytes(healthData.metrics.memory.total)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Диск простор" />
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <DiskIcon color="primary" />
                    <Box flexGrow={1}>
                      <Typography variant="h6">
                        {SerbianFormat.formatPercentage(healthData.metrics.disk.percentage || 0)}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={healthData.metrics.disk.percentage || 0}
                        color={(healthData.metrics.disk.percentage || 0) > 90 ? 'error' : 
                               (healthData.metrics.disk.percentage || 0) > 80 ? 'warning' : 'primary'}
                      />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {formatBytes(healthData.metrics.disk.used)} / {formatBytes(healthData.metrics.disk.total)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Графици метрика */}
          {metricsHistory.length > 0 && (
            <Grid container spacing={3} mb={4}>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Тренд коришћења ресурса (последњих 20 мерења)
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={metricsHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis domain={[0, 100]} />
                      <ChartTooltip 
                        formatter={(value: number, name: string) => [
                          `${SerbianFormat.formatPercentage(value)}`,
                          name === 'cpuUsage' ? 'CPU' : 
                          name === 'memoryUsage' ? 'Меморија' : 'Диск'
                        ]}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="cpuUsage" 
                        stackId="1"
                        stroke="#2196f3" 
                        fill="#2196f3"
                        fillOpacity={0.3}
                        name="CPU %"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="memoryUsage" 
                        stackId="2"
                        stroke="#4caf50" 
                        fill="#4caf50"
                        fillOpacity={0.3}
                        name="Меморија %"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="diskUsage" 
                        stackId="3"
                        stroke="#ff9800" 
                        fill="#ff9800"
                        fillOpacity={0.3}
                        name="Диск %"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* Провере компоненти */}
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Card>
                <CardHeader title="Статус компоненти система" />
                <CardContent>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Компонента</TableCell>
                          <TableCell>Статус</TableCell>
                          <TableCell>Време одговора</TableCell>
                          <TableCell>Порука</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {healthData.checks.map((check, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                {getComponentIcon(check.name)}
                                {check.name}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={check.status === 'healthy' ? 'Здрав' : 
                                       check.status === 'warning' ? 'Упозорење' : 'Критично'}
                                color={getStatusColor(check.status) as any}
                                size="small"
                                icon={getStatusIcon(check.status)}
                              />
                            </TableCell>
                            <TableCell>
                              {check.responseTime ? `${check.responseTime}ms` : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {check.message}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Card>
                <CardHeader title="Акције" />
                <CardContent>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => fetchHealthData()}
                    disabled={refreshing}
                    startIcon={refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
                    sx={{ mb: 2 }}
                  >
                    {refreshing ? 'Освежавам...' : 'Освежи статус'}
                  </Button>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Системске информације
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Окружење"
                        secondary={process.env.NODE_ENV || 'development'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Верзија"
                        secondary="1.0.0"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Укупно провера"
                        secondary={healthData.summary.total}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default SystemHealthPage; 