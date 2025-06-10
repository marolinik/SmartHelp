import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Speed as SpeedIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  BarChart as BarChartIcon,
  Dashboard as DashboardIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { sr } from 'date-fns/locale';

interface RoutingMetrics {
  totalRoutingDecisions: number;
  successfulRoutes: number;
  reroutingCount: number;
  averageConfidence: number;
  routingEfficiency: number;
  agentUtilizationVariance: number;
}

interface AgentPerformance {
  agentId: string;
  agentName: string;
  ticketsAssigned: number;
  averageScore: number;
  successRate: number;
  averageResponseTime: number;
  utilizationPercent: number;
  stressLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface RoutingTrend {
  date: string;
  totalTickets: number;
  successfulRoutes: number;
  averageConfidence: number;
  reroutingRate: number;
}

interface CategoryDistribution {
  category: string;
  displayName: string;
  count: number;
  percentage: number;
  averageRoutingTime: number;
  successRate: number;
}

interface LoadBalancingMetrics {
  lastRebalanceTime: string;
  rebalanceCount: number;
  ticketsMoved: number;
  efficiencyImprovement: number;
  currentVariance: number;
  targetVariance: number;
}

const RoutingMetricsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState('last7days');
  const [refreshInterval, setRefreshInterval] = useState<number | null>(30000); // 30 seconds
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Metrics data
  const [routingMetrics, setRoutingMetrics] = useState<RoutingMetrics>({
    totalRoutingDecisions: 0,
    successfulRoutes: 0,
    reroutingCount: 0,
    averageConfidence: 0,
    routingEfficiency: 0,
    agentUtilizationVariance: 0
  });

  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [routingTrends, setRoutingTrends] = useState<RoutingTrend[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
  const [loadBalancingMetrics, setLoadBalancingMetrics] = useState<LoadBalancingMetrics>({
    lastRebalanceTime: '',
    rebalanceCount: 0,
    ticketsMoved: 0,
    efficiencyImprovement: 0,
    currentVariance: 0,
    targetVariance: 20
  });

  useEffect(() => {
    loadMetricsData();
  }, [dateRange]);

  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(() => {
        loadMetricsData();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, dateRange]);

  const loadMetricsData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRoutingMetrics(),
        loadAgentPerformance(),
        loadRoutingTrends(),
        loadCategoryDistribution(),
        loadLoadBalancingMetrics()
      ]);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Грешка при учитавању метрика:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoutingMetrics = async () => {
    try {
      const response = await fetch(`/api/routing/statistics?dateRange=${dateRange}`);
      if (response.ok) {
        const data = await response.json();
        setRoutingMetrics({
          totalRoutingDecisions: data.data?.totalDecisions || 1247,
          successfulRoutes: data.data?.successfulRoutes || 1176,
          reroutingCount: data.data?.reroutingCount || 71,
          averageConfidence: data.data?.averageConfidence || 87.3,
          routingEfficiency: ((data.data?.successfulRoutes || 1176) / (data.data?.totalDecisions || 1247)) * 100,
          agentUtilizationVariance: 15.2
        });
      } else {
        // Mock data
        setRoutingMetrics({
          totalRoutingDecisions: 1247,
          successfulRoutes: 1176,
          reroutingCount: 71,
          averageConfidence: 87.3,
          routingEfficiency: 94.3,
          agentUtilizationVariance: 15.2
        });
      }
    } catch (error) {
      console.error('Грешка при учитавању основних метрика:', error);
    }
  };

  const loadAgentPerformance = async () => {
    // Mock data - would fetch from API
    const mockPerformance: AgentPerformance[] = [
      {
        agentId: 'agent-1',
        agentName: 'Марко Петровић',
        ticketsAssigned: 142,
        averageScore: 8.7,
        successRate: 95.8,
        averageResponseTime: 12.3,
        utilizationPercent: 78,
        stressLevel: 'medium'
      },
      {
        agentId: 'agent-2',
        agentName: 'Ана Јовановић',
        ticketsAssigned: 156,
        averageScore: 9.2,
        successRate: 97.4,
        averageResponseTime: 9.8,
        utilizationPercent: 82,
        stressLevel: 'medium'
      },
      {
        agentId: 'agent-3',
        agentName: 'Милош Николић',
        ticketsAssigned: 89,
        averageScore: 7.4,
        successRate: 88.1,
        averageResponseTime: 18.7,
        utilizationPercent: 45,
        stressLevel: 'low'
      },
      {
        agentId: 'agent-4',
        agentName: 'Тамара Стојановић',
        ticketsAssigned: 134,
        averageScore: 8.9,
        successRate: 94.2,
        averageResponseTime: 11.2,
        utilizationPercent: 89,
        stressLevel: 'high'
      }
    ];
    setAgentPerformance(mockPerformance);
  };

  const loadRoutingTrends = async () => {
    // Mock trend data
    const mockTrends: RoutingTrend[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      mockTrends.push({
        date: format(date, 'yyyy-MM-dd'),
        totalTickets: Math.floor(Math.random() * 50) + 150,
        successfulRoutes: Math.floor(Math.random() * 45) + 140,
        averageConfidence: Math.random() * 20 + 80,
        reroutingRate: Math.random() * 10 + 5
      });
    }
    setRoutingTrends(mockTrends);
  };

  const loadCategoryDistribution = async () => {
    const mockDistribution: CategoryDistribution[] = [
      {
        category: 'hardware',
        displayName: 'Хардвер',
        count: 312,
        percentage: 25.0,
        averageRoutingTime: 2.3,
        successRate: 95.2
      },
      {
        category: 'software',
        displayName: 'Софтвер',
        count: 298,
        percentage: 23.9,
        averageRoutingTime: 1.8,
        successRate: 96.7
      },
      {
        category: 'network',
        displayName: 'Мрежа',
        count: 187,
        percentage: 15.0,
        averageRoutingTime: 3.1,
        successRate: 91.4
      },
      {
        category: 'email',
        displayName: 'Емејл',
        count: 234,
        percentage: 18.8,
        averageRoutingTime: 1.2,
        successRate: 98.1
      },
      {
        category: 'security',
        displayName: 'Безбедност',
        count: 156,
        percentage: 12.5,
        averageRoutingTime: 4.2,
        successRate: 89.7
      },
      {
        category: 'training',
        displayName: 'Обука',
        count: 60,
        percentage: 4.8,
        averageRoutingTime: 0.8,
        successRate: 99.2
      }
    ];
    setCategoryDistribution(mockDistribution);
  };

  const loadLoadBalancingMetrics = async () => {
    const mockLoadBalancing: LoadBalancingMetrics = {
      lastRebalanceTime: format(subDays(new Date(), 2), "yyyy-MM-dd'T'HH:mm:ss"),
      rebalanceCount: 12,
      ticketsMoved: 47,
      efficiencyImprovement: 23.4,
      currentVariance: 15.2,
      targetVariance: 20
    };
    setLoadBalancingMetrics(mockLoadBalancing);
  };

  const getStressLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  const getStressLevelLabel = (level: string) => {
    switch (level) {
      case 'low': return 'Низак';
      case 'medium': return 'Средњи';
      case 'high': return 'Висок';
      case 'critical': return 'Критичан';
      default: return level;
    }
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) {
      return <TrendingUpIcon color="success" />;
    } else if (current < previous) {
      return <TrendingDownIcon color="error" />;
    }
    return <TrendingUpIcon color="disabled" />;
  };

  const renderOverviewCards = () => (
    <Grid container spacing={3} mb={3}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Укупно Рутирања
                </Typography>
                <Typography variant="h4">
                  {routingMetrics.totalRoutingDecisions.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="success.main">
                  {getTrendIcon(routingMetrics.totalRoutingDecisions, 1180)} +5.7%
                </Typography>
              </Box>
              <AssignmentIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Ефикасност Рутирања
                </Typography>
                <Typography variant="h4">
                  {routingMetrics.routingEfficiency.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="success.main">
                  {getTrendIcon(94.3, 92.1)} +2.4%
                </Typography>
              </Box>
              <SpeedIcon color="success" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Просечно Поверење
                </Typography>
                <Typography variant="h4">
                  {routingMetrics.averageConfidence.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="success.main">
                  {getTrendIcon(87.3, 85.8)} +1.7%
                </Typography>
              </Box>
              <CheckCircleIcon color="info" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Преусмеравања
                </Typography>
                <Typography variant="h4">
                  {routingMetrics.reroutingCount}
                </Typography>
                <Typography variant="body2" color="error.main">
                  {getTrendIcon(65, 71)} -8.5%
                </Typography>
              </Box>
              <WarningIcon color="warning" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderAgentPerformanceTable = () => (
    <Card>
      <CardHeader 
        title="Перформансе Агената" 
        action={
          <Chip 
            label={`Ажурирано: ${format(lastRefresh, 'HH:mm:ss', { locale: sr })}`}
            size="small"
            variant="outlined"
          />
        }
      />
      <CardContent>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Агент</TableCell>
                <TableCell align="right">Тикети</TableCell>
                <TableCell align="right">Просечна Оцена</TableCell>
                <TableCell align="right">Успешност</TableCell>
                <TableCell align="right">Одзив (мин)</TableCell>
                <TableCell align="center">Искоришћеност</TableCell>
                <TableCell align="center">Стрес Ниво</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agentPerformance.map((agent) => (
                <TableRow key={agent.agentId}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {agent.agentName}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{agent.ticketsAssigned}</TableCell>
                  <TableCell align="right">
                    <Box display="flex" alignItems="center" justifyContent="flex-end">
                      <Typography variant="body2" mr={1}>
                        {agent.averageScore.toFixed(1)}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(agent.averageScore / 10) * 100} 
                        sx={{ width: 40 }}
                        color="primary"
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="right">{agent.successRate.toFixed(1)}%</TableCell>
                  <TableCell align="right">{agent.averageResponseTime.toFixed(1)}</TableCell>
                  <TableCell align="center">
                    <Box display="flex" alignItems="center" justifyContent="center">
                      <Typography variant="body2" mr={1}>
                        {agent.utilizationPercent}%
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={agent.utilizationPercent} 
                        sx={{ width: 60 }}
                        color={
                          agent.utilizationPercent > 90 ? 'error' :
                          agent.utilizationPercent > 70 ? 'warning' : 'success'
                        }
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={getStressLevelLabel(agent.stressLevel)}
                      size="small"
                      color={getStressLevelColor(agent.stressLevel)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  const renderCategoryDistribution = () => (
    <Card>
      <CardHeader title="Дистрибуција по Категоријама" />
      <CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Категорија</TableCell>
                <TableCell align="right">Број</TableCell>
                <TableCell align="right">Проценат</TableCell>
                <TableCell align="right">Просечно Време (с)</TableCell>
                <TableCell align="right">Успешност</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categoryDistribution.map((category) => (
                <TableRow key={category.category}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {category.displayName}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{category.count}</TableCell>
                  <TableCell align="right">
                    <Box display="flex" alignItems="center" justifyContent="flex-end">
                      <Typography variant="body2" mr={1}>
                        {category.percentage.toFixed(1)}%
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={category.percentage} 
                        sx={{ width: 50 }}
                        color="primary"
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="right">{category.averageRoutingTime.toFixed(1)}</TableCell>
                  <TableCell align="right">
                    <Typography 
                      variant="body2"
                      color={category.successRate > 95 ? 'success.main' : 
                             category.successRate > 90 ? 'warning.main' : 'error.main'}
                    >
                      {category.successRate.toFixed(1)}%
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  const renderLoadBalancingMetrics = () => (
    <Card>
      <CardHeader title="Распоређивање Оптерећења" />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Box mb={2}>
              <Typography variant="body2" color="textSecondary">
                Последње Распоређивање
              </Typography>
              <Typography variant="h6">
                {format(new Date(loadBalancingMetrics.lastRebalanceTime), 'dd.MM.yyyy HH:mm', { locale: sr })}
              </Typography>
            </Box>
            <Box mb={2}>
              <Typography variant="body2" color="textSecondary">
                Број Распоређивања (7 дана)
              </Typography>
              <Typography variant="h6">{loadBalancingMetrics.rebalanceCount}</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box mb={2}>
              <Typography variant="body2" color="textSecondary">
                Премештени Тикети
              </Typography>
              <Typography variant="h6">{loadBalancingMetrics.ticketsMoved}</Typography>
            </Box>
            <Box mb={2}>
              <Typography variant="body2" color="textSecondary">
                Побољшање Ефикасности
              </Typography>
              <Typography variant="h6" color="success.main">
                +{loadBalancingMetrics.efficiencyImprovement.toFixed(1)}%
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" color="textSecondary">
                Тренутна Варијанса Искоришћености
              </Typography>
              <Box display="flex" alignItems="center">
                <LinearProgress 
                  variant="determinate" 
                  value={(loadBalancingMetrics.currentVariance / loadBalancingMetrics.targetVariance) * 100} 
                  sx={{ width: 100, mr: 1 }}
                  color={loadBalancingMetrics.currentVariance > loadBalancingMetrics.targetVariance ? 'error' : 'success'}
                />
                <Typography variant="body2">
                  {loadBalancingMetrics.currentVariance.toFixed(1)}% / {loadBalancingMetrics.targetVariance}%
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" display="flex" alignItems="center" gap={1}>
            <BarChartIcon />
            Метрике Рутирања
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Аналитика и перформансе система паметног рутирања тикета
          </Typography>
        </Box>

        <Box display="flex" gap={1} alignItems="center">
          {/* Date Range Selector */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Период</InputLabel>
            <Select
              value={dateRange}
              label="Период"
              onChange={(e) => setDateRange(e.target.value)}
            >
              <MenuItem value="today">Данас</MenuItem>
              <MenuItem value="yesterday">Јуче</MenuItem>
              <MenuItem value="last7days">Последњих 7 дана</MenuItem>
              <MenuItem value="last30days">Последњих 30 дана</MenuItem>
              <MenuItem value="thisMonth">Овај месец</MenuItem>
            </Select>
          </FormControl>

          {/* Auto Refresh */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Освежавање</InputLabel>
            <Select
              value={refreshInterval || 'off'}
              label="Освежавање"
              onChange={(e) => setRefreshInterval(e.target.value === 'off' ? null : Number(e.target.value))}
            >
              <MenuItem value="off">Искључено</MenuItem>
              <MenuItem value={10000}>10 сек</MenuItem>
              <MenuItem value={30000}>30 сек</MenuItem>
              <MenuItem value={60000}>1 мин</MenuItem>
              <MenuItem value={300000}>5 мин</MenuItem>
            </Select>
          </FormControl>

          {/* Manual Refresh */}
          <Tooltip title="Освежи податке">
            <IconButton onClick={loadMetricsData} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Overview Cards */}
      {renderOverviewCards()}

      {/* Main Content */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          {renderAgentPerformanceTable()}
        </Grid>
        
        <Grid item xs={12} md={8}>
          {renderCategoryDistribution()}
        </Grid>
        
        <Grid item xs={12} md={4}>
          {renderLoadBalancingMetrics()}
        </Grid>
      </Grid>

      {/* Status Alert */}
      {routingMetrics.routingEfficiency < 90 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          <Typography variant="body2">
            Ефикасност рутирања је испод препоручене вредности (90%). 
            Размотрите прилагођавање тежишних вредности или провера правила рутирања.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default RoutingMetricsDashboard; 