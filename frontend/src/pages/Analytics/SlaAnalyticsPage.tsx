import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Analytics as AnalyticsIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, subDays, subWeeks, subMonths } from 'date-fns';
import { sr } from 'date-fns/locale';
import { SerbianFormat } from '../../utils/formatting';

// Types
interface SlaMetrics {
  totalTickets: number;
  onTrackTickets: number;
  warningTickets: number;
  breachedTickets: number;
  complianceRate: number;
  averageResponseTime: number;
  averageResolutionTime: number;
}

interface DashboardSummary {
  currentPeriod: {
    from: string;
    to: string;
    metrics: SlaMetrics;
  };
  previousPeriod: {
    from: string;
    to: string;
    metrics: SlaMetrics;
  };
  changes: {
    complianceRate: number;
    averageResponseTime: number;
    averageResolutionTime: number;
  };
  topViolatingCategories: Array<{
    categoryName: string;
    violations: number;
    complianceRate: number;
  }>;
  breachTrend: Array<{
    date: string;
    breaches: number;
  }>;
  summary: {
    label: string;
    generatedAt: string;
  };
}

interface PerformanceTrend {
  period: string;
  complianceRate: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  totalTickets: number;
  breaches: number;
}

const SlaAnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [performanceTrend, setPerformanceTrend] = useState<PerformanceTrend[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('last7days');
  const [reportType, setReportType] = useState('daily');

  // Періоди за извештаје
  const periods = [
    { value: 'last7days', label: 'Задњих 7 дана' },
    { value: 'last30days', label: 'Задњих 30 дана' },
    { value: 'lastWeek', label: 'Прошла недеља' },
    { value: 'lastMonth', label: 'Прошли месец' },
    { value: 'last3months', label: 'Задња 3 месеца' }
  ];

  const reportTypes = [
    { value: 'daily', label: 'Дневни' },
    { value: 'weekly', label: 'Недељни' },
    { value: 'monthly', label: 'Месечни' }
  ];

  // Учитај dashboard податке
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/sla/reports/dashboard-summary', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Грешка при учитавању dashboard података');
      }

      const data = await response.json();
      if (data.success) {
        setDashboardData(data.data);
      } else {
        throw new Error('Неуспешан одговор сервера');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Непозната грешка');
    } finally {
      setLoading(false);
    }
  };

  // Учитај тренд перформанси
  const fetchPerformanceTrend = async () => {
    try {
      const token = localStorage.getItem('token');
      let startDate: Date;
      const endDate = new Date();

      switch (selectedPeriod) {
        case 'last7days':
          startDate = subDays(endDate, 7);
          break;
        case 'last30days':
          startDate = subDays(endDate, 30);
          break;
        case 'lastWeek':
          startDate = subWeeks(endDate, 1);
          break;
        case 'lastMonth':
          startDate = subMonths(endDate, 1);
          break;
        case 'last3months':
          startDate = subMonths(endDate, 3);
          break;
        default:
          startDate = subDays(endDate, 7);
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reportType: reportType
      });

      const response = await fetch(`/api/sla/reports/performance-trend?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPerformanceTrend(data.data);
        }
      }
    } catch (error) {
      console.error('Грешка при учитавању тренда:', error);
    }
  };

  // Експортуј CSV извештај
  const exportCsvReport = async () => {
    try {
      const token = localStorage.getItem('token');
      let startDate: Date;
      const endDate = new Date();

      switch (selectedPeriod) {
        case 'last7days':
          startDate = subDays(endDate, 7);
          break;
        case 'last30days':
          startDate = subDays(endDate, 30);
          break;
        case 'lastWeek':
          startDate = subWeeks(endDate, 1);
          break;
        case 'lastMonth':
          startDate = subMonths(endDate, 1);
          break;
        case 'last3months':
          startDate = subMonths(endDate, 3);
          break;
        default:
          startDate = subDays(endDate, 7);
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reportType: reportType
      });

      const response = await fetch(`/api/sla/reports/export/csv?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SLA_Izvestaj_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Грешка при експорту:', error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchPerformanceTrend();
  }, [selectedPeriod, reportType]);

  // Помоћне функције за приказ
  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp color="success" />;
    if (value < 0) return <TrendingDown color="error" />;
    return <TrendingFlat color="info" />;
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${SerbianFormat.formatDecimal(Math.abs(value), 1)}%`;
  };

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${SerbianFormat.formatInteger(Math.round(hours * 60))} мин`;
    }
    return `${SerbianFormat.formatDecimal(hours, 1)}h`;
  };

  // Pie chart подаци за SLA статус
  const getSlaStatusData = () => {
    if (!dashboardData) return [];
    
    const { metrics } = dashboardData.currentPeriod;
    return [
      { name: 'У року', value: metrics.onTrackTickets, fill: '#4CAF50' },
      { name: 'Упозорење', value: metrics.warningTickets, fill: '#FF9800' },
      { name: 'Прекршено', value: metrics.breachedTickets, fill: '#F44336' }
    ];
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <AnalyticsIcon />
          SLA Аналитика
        </Typography>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Период</InputLabel>
            <Select
              value={selectedPeriod}
              label="Период"
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              {periods.map((period) => (
                <MenuItem key={period.value} value={period.value}>
                  {period.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Тип извештаја</InputLabel>
            <Select
              value={reportType}
              label="Тип извештаја"
              onChange={(e) => setReportType(e.target.value)}
            >
              {reportTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportCsvReport}
          >
            Експортуј CSV
          </Button>
          <Tooltip title="Освежи податке">
            <IconButton onClick={fetchDashboardData}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {dashboardData && (
        <>
          {/* Кључне метрике */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h4" color="primary">
                        {SerbianFormat.formatPercentage(dashboardData.currentPeriod.metrics.complianceRate)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        SLA Усклађеност
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {getTrendIcon(dashboardData.changes.complianceRate)}
                      <Typography variant="body2" color={dashboardData.changes.complianceRate >= 0 ? 'success.main' : 'error.main'}>
                        {formatPercentage(dashboardData.changes.complianceRate)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h4" color="info.main">
                        {dashboardData.currentPeriod.metrics.totalTickets}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Укупно тикета
                      </Typography>
                    </Box>
                    <ScheduleIcon color="info" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h4" color="warning.main">
                        {formatHours(dashboardData.currentPeriod.metrics.averageResponseTime)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Просечан одзив
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {getTrendIcon(-dashboardData.changes.averageResponseTime)}
                      <Typography variant="body2" color={dashboardData.changes.averageResponseTime <= 0 ? 'success.main' : 'error.main'}>
                        {formatHours(Math.abs(dashboardData.changes.averageResponseTime))}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h4" color="secondary.main">
                        {formatHours(dashboardData.currentPeriod.metrics.averageResolutionTime)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Просечно решавање
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {getTrendIcon(-dashboardData.changes.averageResolutionTime)}
                      <Typography variant="body2" color={dashboardData.changes.averageResolutionTime <= 0 ? 'success.main' : 'error.main'}>
                        {formatHours(Math.abs(dashboardData.changes.averageResolutionTime))}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Графици */}
          <Grid container spacing={3} mb={4}>
            {/* Тренд перформанси */}
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Тренд SLA перформанси
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <ChartTooltip
                      labelFormatter={(label) => `Период: ${label}`}
                      formatter={(value: number, name: string) => {
                        if (name === 'complianceRate') return [`${SerbianFormat.formatPercentage(value)}`, 'Усклађеност'];
                        if (name === 'averageResponseTime') return [`${SerbianFormat.formatDecimal(value, 1)}h`, 'Просечан одзив'];
                        if (name === 'averageResolutionTime') return [`${SerbianFormat.formatDecimal(value, 1)}h`, 'Просечно решавање'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="complianceRate" 
                      stroke="#4CAF50" 
                      name="Усклађеност (%)"
                      yAxisId="left"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="averageResponseTime" 
                      stroke="#FF9800" 
                      name="Просечан одзив (h)"
                      yAxisId="right"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* SLA статус распоред */}
            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Распоред SLA статуса
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getSlaStatusData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value} (${SerbianFormat.formatInteger(percent * 100)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getSlaStatusData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Додатни графици */}
          <Grid container spacing={3}>
            {/* Тренд прекршаја */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Тренд SLA прекршаја (задњих 7 дана)
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={dashboardData.breachTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'dd.MM', { locale: sr })}
                    />
                    <YAxis />
                    <ChartTooltip
                      labelFormatter={(date) => format(new Date(date), 'dd.MM.yyyy', { locale: sr })}
                      formatter={(value: number) => [value, 'Прекршаји']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="breaches" 
                      stroke="#F44336" 
                      fill="#F44336" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Топ категорије са прекршајима */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Топ категорије са SLA прекршајима
                </Typography>
                <Stack spacing={2}>
                  {dashboardData.topViolatingCategories.map((category, index) => (
                    <Box key={index} display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">
                        {category.categoryName}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip 
                          label={`${category.violations} прекршаја`}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                        <Chip 
                          label={`${SerbianFormat.formatPercentage(category.complianceRate)} усклађеност`}
                          size="small"
                          color={category.complianceRate >= 90 ? 'success' : category.complianceRate >= 70 ? 'warning' : 'error'}
                        />
                      </Box>
                    </Box>
                  ))}
                  {dashboardData.topViolatingCategories.length === 0 && (
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      Нема SLA прекршаја у изабраном периоду
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default SlaAnalyticsPage; 