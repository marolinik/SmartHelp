import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Tooltip,
  Paper,
  Fab,
  LinearProgress
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as AssignmentIcon,
  Speed as SpeedIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

// Chart components
import TicketVolumeChart from './charts/TicketVolumeChart';
import SlaComplianceChart from './charts/SlaComplianceChart';
import UserPerformanceChart from './charts/UserPerformanceChart';
import TrendAnalysisChart from './charts/TrendAnalysisChart';
import MetricCard from './widgets/MetricCard';
import PerformanceGauge from './widgets/PerformanceGauge';

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'text';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  configuration: any;
  dataSource: string;
  refreshInterval: number; // in seconds
  isVisible: boolean;
}

export interface DashboardMetrics {
  ticketVolume: {
    total: number;
    resolved: number;
    pending: number;
    trend: number; // percentage change
  };
  slaCompliance: {
    overall: number;
    response: number;
    resolution: number;
    trend: number;
  };
  userPerformance: {
    activeAgents: number;
    avgResolutionTime: number; // minutes
    topPerformer: string;
    efficiency: number; // percentage
  };
  systemUsage: {
    activeUsers: number;
    sessionsToday: number;
    avgSessionTime: number; // minutes
    systemLoad: number; // percentage
  };
}

const AnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [widgetMenuAnchor, setWidgetMenuAnchor] = useState<HTMLElement | null>(null);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [editWidgetOpen, setEditWidgetOpen] = useState(false);
  const [dateRange, setDateRange] = useState('last30days');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Default widgets layout
  const defaultWidgets: DashboardWidget[] = [
    {
      id: 'ticket-volume',
      type: 'chart',
      title: 'Обим Тикета',
      position: { x: 0, y: 0, width: 6, height: 4 },
      configuration: {
        chartType: 'line',
        showLegend: true,
        timeframe: '30days'
      },
      dataSource: 'tickets',
      refreshInterval: 300,
      isVisible: true
    },
    {
      id: 'sla-compliance',
      type: 'chart',
      title: 'SLA Усаглашеност',
      position: { x: 6, y: 0, width: 6, height: 4 },
      configuration: {
        chartType: 'gauge',
        showTarget: true,
        target: 95
      },
      dataSource: 'sla',
      refreshInterval: 600,
      isVisible: true
    },
    {
      id: 'metrics-overview',
      type: 'metric',
      title: 'Кључне Метрике',
      position: { x: 0, y: 4, width: 4, height: 2 },
      configuration: {
        layout: 'grid',
        showTrends: true
      },
      dataSource: 'overview',
      refreshInterval: 180,
      isVisible: true
    },
    {
      id: 'user-performance',
      type: 'chart',
      title: 'Перформансе Корисника',
      position: { x: 4, y: 4, width: 8, height: 2 },
      configuration: {
        chartType: 'bar',
        showTop: 10,
        sortBy: 'efficiency'
      },
      dataSource: 'users',
      refreshInterval: 900,
      isVisible: true
    }
  ];

  useEffect(() => {
    initializeDashboard();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refreshDashboardData();
      }, 60000); // Refresh every minute

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const initializeDashboard = async () => {
    try {
      setLoading(true);
      
      // Load saved widgets or use defaults
      const savedWidgets = localStorage.getItem('analytics-dashboard-widgets');
      if (savedWidgets) {
        setWidgets(JSON.parse(savedWidgets));
      } else {
        setWidgets(defaultWidgets);
      }

      await refreshDashboardData();
    } catch (error) {
      console.error('Greška pri inicijalizaciji dashboard-a:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboardData = async () => {
    try {
      // Mock data - would fetch from analytics API
      const mockMetrics: DashboardMetrics = {
        ticketVolume: {
          total: 1247,
          resolved: 1089,
          pending: 158,
          trend: 12.5
        },
        slaCompliance: {
          overall: 94.2,
          response: 96.1,
          resolution: 92.3,
          trend: 2.1
        },
        userPerformance: {
          activeAgents: 23,
          avgResolutionTime: 284, // minutes
          topPerformer: 'Марко Петровић',
          efficiency: 87.5
        },
        systemUsage: {
          activeUsers: 156,
          sessionsToday: 312,
          avgSessionTime: 45,
          systemLoad: 68.2
        }
      };

      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Greška pri učitavanju podataka:', error);
    }
  };

  const handleWidgetMenuOpen = (event: React.MouseEvent<HTMLElement>, widgetId: string) => {
    setSelectedWidget(widgetId);
    setWidgetMenuAnchor(event.currentTarget);
  };

  const handleWidgetMenuClose = () => {
    setSelectedWidget(null);
    setWidgetMenuAnchor(null);
  };

  const handleEditWidget = (widgetId: string) => {
    setSelectedWidget(widgetId);
    setEditWidgetOpen(true);
    handleWidgetMenuClose();
  };

  const handleDeleteWidget = (widgetId: string) => {
    const updatedWidgets = widgets.filter(w => w.id !== widgetId);
    setWidgets(updatedWidgets);
    localStorage.setItem('analytics-dashboard-widgets', JSON.stringify(updatedWidgets));
    handleWidgetMenuClose();
  };

  const handleAddWidget = (newWidget: Omit<DashboardWidget, 'id'>) => {
    const widget: DashboardWidget = {
      ...newWidget,
      id: `widget-${Date.now()}`
    };
    const updatedWidgets = [...widgets, widget];
    setWidgets(updatedWidgets);
    localStorage.setItem('analytics-dashboard-widgets', JSON.stringify(updatedWidgets));
    setAddWidgetOpen(false);
  };

  const handleUpdateWidget = (widgetId: string, updates: Partial<DashboardWidget>) => {
    const updatedWidgets = widgets.map(w => 
      w.id === widgetId ? { ...w, ...updates } : w
    );
    setWidgets(updatedWidgets);
    localStorage.setItem('analytics-dashboard-widgets', JSON.stringify(updatedWidgets));
    setEditWidgetOpen(false);
  };

  const renderWidget = (widget: DashboardWidget) => {
    if (!widget.isVisible) return null;

    const widgetContent = () => {
      switch (widget.type) {
        case 'chart':
          return renderChartWidget(widget);
        case 'metric':
          return renderMetricWidget(widget);
        case 'table':
          return renderTableWidget(widget);
        case 'text':
          return renderTextWidget(widget);
        default:
          return <Typography>Непознат тип widget-a</Typography>;
      }
    };

    return (
      <Grid
        item
        xs={widget.position.width}
        key={widget.id}
        sx={{ height: widget.position.height * 100 }}
      >
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <CardHeader
            title={widget.title}
            action={
              <IconButton
                size="small"
                onClick={(e) => handleWidgetMenuOpen(e, widget.id)}
              >
                <MoreVertIcon />
              </IconButton>
            }
            sx={{ pb: 1 }}
          />
          <CardContent sx={{ flex: 1, pt: 0 }}>
            {widgetContent()}
          </CardContent>
        </Card>
      </Grid>
    );
  };

  const renderChartWidget = (widget: DashboardWidget) => {
    switch (widget.dataSource) {
      case 'tickets':
        return <TicketVolumeChart configuration={widget.configuration} />;
      case 'sla':
        return <SlaComplianceChart configuration={widget.configuration} />;
      case 'users':
        return <UserPerformanceChart configuration={widget.configuration} />;
      case 'trends':
        return <TrendAnalysisChart configuration={widget.configuration} />;
      default:
        return <Typography>Није конфигурисан извор података</Typography>;
    }
  };

  const renderMetricWidget = (widget: DashboardWidget) => {
    if (!metrics) return <LinearProgress />;

    return (
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <MetricCard
            title="Укупно Тикета"
            value={metrics.ticketVolume.total}
            trend={metrics.ticketVolume.trend}
            icon={<AssignmentIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={6}>
          <MetricCard
            title="SLA Усаглашеност"
            value={metrics.slaCompliance.overall}
            trend={metrics.slaCompliance.trend}
            icon={<SpeedIcon />}
            color="success"
            suffix="%"
          />
        </Grid>
        <Grid item xs={6}>
          <MetricCard
            title="Активни Агенти"
            value={metrics.userPerformance.activeAgents}
            icon={<PeopleIcon />}
            color="info"
          />
        </Grid>
        <Grid item xs={6}>
          <MetricCard
            title="Активни Корисници"
            value={metrics.systemUsage.activeUsers}
            icon={<TrendingUpIcon />}
            color="warning"
          />
        </Grid>
      </Grid>
    );
  };

  const renderTableWidget = (widget: DashboardWidget) => {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          Табела widget - у развоју
        </Typography>
      </Box>
    );
  };

  const renderTextWidget = (widget: DashboardWidget) => {
    return (
      <Box>
        <Typography variant="body1">
          {widget.configuration.content || 'Унесите садржај widget-a'}
        </Typography>
      </Box>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" display="flex" alignItems="center" gap={1}>
            <DashboardIcon />
            Аналитички Преглед
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Последњи ажуриран: {format(new Date(), 'dd.MM.yyyy HH:mm', { locale: sr })}
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
              <MenuItem value="last90days">Последњих 90 дана</MenuItem>
              <MenuItem value="thisMonth">Овај месец</MenuItem>
              <MenuItem value="lastMonth">Прошли месец</MenuItem>
            </Select>
          </FormControl>

          {/* Auto Refresh Toggle */}
          <Chip
            label={autoRefresh ? 'Ауто освежавање' : 'Мануелно'}
            color={autoRefresh ? 'success' : 'default'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            icon={<RefreshIcon />}
            variant={autoRefresh ? 'filled' : 'outlined'}
          />

          {/* Manual Refresh */}
          <Tooltip title="Освежи податке">
            <IconButton onClick={refreshDashboardData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          {/* Settings */}
          <Tooltip title="Подешавања">
            <IconButton>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Dashboard Grid */}
      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <LinearProgress sx={{ width: '50%' }} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {widgets.map(widget => renderWidget(widget))}
        </Grid>
      )}

      {/* Add Widget FAB */}
      <Fab
        color="primary"
        aria-label="додај widget"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setAddWidgetOpen(true)}
      >
        <AddIcon />
      </Fab>

      {/* Widget Context Menu */}
      <Menu
        anchorEl={widgetMenuAnchor}
        open={Boolean(widgetMenuAnchor)}
        onClose={handleWidgetMenuClose}
      >
        <MenuItem onClick={() => selectedWidget && handleEditWidget(selectedWidget)}>
          <EditIcon sx={{ mr: 1 }} />
          Уреди
        </MenuItem>
        <MenuItem onClick={() => selectedWidget && handleDeleteWidget(selectedWidget)}>
          <DeleteIcon sx={{ mr: 1 }} />
          Обриши
        </MenuItem>
      </Menu>

      {/* Add Widget Dialog */}
      <AddWidgetDialog
        open={addWidgetOpen}
        onClose={() => setAddWidgetOpen(false)}
        onAdd={handleAddWidget}
      />

      {/* Edit Widget Dialog */}
      <EditWidgetDialog
        open={editWidgetOpen}
        widget={widgets.find(w => w.id === selectedWidget)}
        onClose={() => setEditWidgetOpen(false)}
        onUpdate={handleUpdateWidget}
      />
    </Box>
  );
};

// Add Widget Dialog Component
interface AddWidgetDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (widget: Omit<DashboardWidget, 'id'>) => void;
}

const AddWidgetDialog: React.FC<AddWidgetDialogProps> = ({ open, onClose, onAdd }) => {
  const { t } = useTranslation();
  const [widgetType, setWidgetType] = useState<DashboardWidget['type']>('chart');
  const [title, setTitle] = useState('');
  const [dataSource, setDataSource] = useState('tickets');

  const handleAdd = () => {
    const newWidget: Omit<DashboardWidget, 'id'> = {
      type: widgetType,
      title: title || 'Нови Widget',
      position: { x: 0, y: 0, width: 6, height: 4 },
      configuration: {},
      dataSource,
      refreshInterval: 300,
      isVisible: true
    };

    onAdd(newWidget);
    setTitle('');
    setWidgetType('chart');
    setDataSource('tickets');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Додај Нови Widget</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Назив Widget-a"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Тип Widget-a</InputLabel>
              <Select
                value={widgetType}
                label="Тип Widget-a"
                onChange={(e) => setWidgetType(e.target.value as DashboardWidget['type'])}
              >
                <MenuItem value="chart">Графикон</MenuItem>
                <MenuItem value="metric">Метрика</MenuItem>
                <MenuItem value="table">Табела</MenuItem>
                <MenuItem value="text">Текст</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Извор Података</InputLabel>
              <Select
                value={dataSource}
                label="Извор Података"
                onChange={(e) => setDataSource(e.target.value)}
              >
                <MenuItem value="tickets">Тикети</MenuItem>
                <MenuItem value="sla">SLA</MenuItem>
                <MenuItem value="users">Корисници</MenuItem>
                <MenuItem value="system">Систем</MenuItem>
                <MenuItem value="trends">Трендови</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Откажи</Button>
        <Button onClick={handleAdd} variant="contained">Додај</Button>
      </DialogActions>
    </Dialog>
  );
};

// Edit Widget Dialog Component
interface EditWidgetDialogProps {
  open: boolean;
  widget?: DashboardWidget;
  onClose: () => void;
  onUpdate: (widgetId: string, updates: Partial<DashboardWidget>) => void;
}

const EditWidgetDialog: React.FC<EditWidgetDialogProps> = ({ 
  open, 
  widget, 
  onClose, 
  onUpdate 
}) => {
  const [title, setTitle] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(300);

  useEffect(() => {
    if (widget) {
      setTitle(widget.title);
      setRefreshInterval(widget.refreshInterval);
    }
  }, [widget]);

  const handleUpdate = () => {
    if (widget) {
      onUpdate(widget.id, {
        title,
        refreshInterval
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Уреди Widget</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Назив Widget-a"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Интервал освежавања (секунде)"
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Откажи</Button>
        <Button onClick={handleUpdate} variant="contained">Сачувај</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AnalyticsDashboard; 