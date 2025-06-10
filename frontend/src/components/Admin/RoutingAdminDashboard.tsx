import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Slider,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Settings as SettingsIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  BarChart as BarChartIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  Speed as SpeedIcon,
  Balance as BalanceIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

interface AgentProfile {
  id: string;
  displayName: string;
  email: string;
  department: string;
  experienceLevel: string;
  isActive: boolean;
  maxConcurrentTickets: number;
  skills: AgentSkill[];
  currentWorkload: number;
  utilizationPercent: number;
}

interface AgentSkill {
  skillId: string;
  skillName: string;
  skillDisplayName: string;
  proficiencyLevel: number;
  category: string;
}

interface RoutingRule {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isActive: boolean;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

interface RuleAction {
  type: string;
  parameters: Record<string, any>;
}

interface RoutingConfiguration {
  skillWeight: number;
  workloadWeight: number;
  performanceWeight: number;
  availabilityWeight: number;
  categoryExperienceWeight: number;
  maxWorkloadDifferencePercent: number;
  emergencyThreshold: number;
  rebalanceInterval: number;
}

interface LoadBalancingConfig {
  strategy: 'round_robin' | 'least_loaded' | 'weighted_distribution' | 'skill_based_balancing';
  isActive: boolean;
  maxWorkloadDifferencePercent: number;
  emergencyThreshold: number;
  rebalanceInterval: number;
}

const RoutingAdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // Agent Management
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  
  // Routing Rules
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<RoutingRule | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  
  // Configuration
  const [routingConfig, setRoutingConfig] = useState<RoutingConfiguration>({
    skillWeight: 35,
    workloadWeight: 25,
    performanceWeight: 20,
    availabilityWeight: 15,
    categoryExperienceWeight: 5,
    maxWorkloadDifferencePercent: 20,
    emergencyThreshold: 90,
    rebalanceInterval: 30
  });
  
  // Load Balancing
  const [loadBalancingConfig, setLoadBalancingConfig] = useState<LoadBalancingConfig>({
    strategy: 'least_loaded',
    isActive: true,
    maxWorkloadDifferencePercent: 20,
    emergencyThreshold: 90,
    rebalanceInterval: 30
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAgents(),
        loadRoutingRules(),
        loadConfiguration()
      ]);
    } catch (error) {
      console.error('Грешка при учитавању података:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/routing/agents');
      if (response.ok) {
        const data = await response.json();
        setAgents(data.data || []);
      }
    } catch (error) {
      console.error('Грешка при учитавању агената:', error);
    }
  };

  const loadRoutingRules = async () => {
    // Mock data - would fetch from API
    const mockRules: RoutingRule[] = [
      {
        id: 'urgent-priority',
        name: 'urgent_priority_routing',
        displayName: 'Хитно Рутирање',
        description: 'Специјално рутирање за хитне тикете',
        isActive: true,
        priority: 1,
        conditions: [
          { field: 'priority', operator: 'equals', value: 'urgent' }
        ],
        actions: [
          { type: 'assign_to_expert', parameters: { minExperienceLevel: 'senior' } }
        ]
      },
      {
        id: 'after-hours',
        name: 'after_hours_routing',
        displayName: 'Ван Радног Времена',
        description: 'Рутирање ван стандардног радног времена',
        isActive: true,
        priority: 2,
        conditions: [
          { field: 'time', operator: 'outside_business_hours', value: '08:00-16:00' }
        ],
        actions: [
          { type: 'assign_to_available', parameters: { onlyAvailable: true } }
        ]
      }
    ];
    setRoutingRules(mockRules);
  };

  const loadConfiguration = async () => {
    // Configuration would be loaded from API
    // Using default values for now
  };

  const handleSaveConfiguration = async () => {
    try {
      setSaveStatus('saving');
      
      // Save configuration to API
      const configData = {
        routing: routingConfig,
        loadBalancing: loadBalancingConfig
      };
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Грешка при чувању конфигурације:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleAgentEdit = (agent: AgentProfile) => {
    setSelectedAgent(agent);
    setAgentDialogOpen(true);
  };

  const handleAgentSave = async (agentData: Partial<AgentProfile>) => {
    try {
      // Save agent to API
      if (selectedAgent) {
        // Update existing agent
        const updatedAgents = agents.map(agent => 
          agent.id === selectedAgent.id ? { ...agent, ...agentData } : agent
        );
        setAgents(updatedAgents);
      } else {
        // Add new agent
        const newAgent: AgentProfile = {
          id: `agent-${Date.now()}`,
          ...agentData
        } as AgentProfile;
        setAgents([...agents, newAgent]);
      }
      
      setAgentDialogOpen(false);
      setSelectedAgent(null);
    } catch (error) {
      console.error('Грешка при чувању агента:', error);
    }
  };

  const renderAgentManagement = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Управљање Агентима</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedAgent(null);
            setAgentDialogOpen(true);
          }}
        >
          Додај Агента
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Име</TableCell>
              <TableCell>Одељење</TableCell>
              <TableCell>Ниво Искуства</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Искоришћеност</TableCell>
              <TableCell>Макс. Тикета</TableCell>
              <TableCell>Акције</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {agent.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {agent.email}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>{agent.department}</TableCell>
                <TableCell>
                  <Chip 
                    label={agent.experienceLevel} 
                    size="small"
                    color={
                      agent.experienceLevel === 'expert' ? 'success' :
                      agent.experienceLevel === 'senior' ? 'primary' :
                      agent.experienceLevel === 'intermediate' ? 'info' : 'default'
                    }
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={agent.isActive ? 'Активан' : 'Неактиван'} 
                    size="small"
                    color={agent.isActive ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2">
                      {agent.utilizationPercent}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={agent.utilizationPercent} 
                      sx={{ width: 60 }}
                      color={
                        agent.utilizationPercent > 90 ? 'error' :
                        agent.utilizationPercent > 70 ? 'warning' : 'primary'
                      }
                    />
                  </Box>
                </TableCell>
                <TableCell>{agent.maxConcurrentTickets}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleAgentEdit(agent)}>
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderRoutingConfiguration = () => (
    <Box>
      <Typography variant="h6" mb={3}>Конфигурација Рутирања</Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Тежишне Вредности Рутирања" />
            <CardContent>
              <Box mb={3}>
                <Typography gutterBottom>Вештине ({routingConfig.skillWeight}%)</Typography>
                <Slider
                  value={routingConfig.skillWeight}
                  onChange={(e, value) => setRoutingConfig({
                    ...routingConfig,
                    skillWeight: value as number
                  })}
                  min={0}
                  max={100}
                  step={5}
                  valueLabelDisplay="auto"
                />
              </Box>
              
              <Box mb={3}>
                <Typography gutterBottom>Радно Оптерећење ({routingConfig.workloadWeight}%)</Typography>
                <Slider
                  value={routingConfig.workloadWeight}
                  onChange={(e, value) => setRoutingConfig({
                    ...routingConfig,
                    workloadWeight: value as number
                  })}
                  min={0}
                  max={100}
                  step={5}
                  valueLabelDisplay="auto"
                />
              </Box>
              
              <Box mb={3}>
                <Typography gutterBottom>Перформансе ({routingConfig.performanceWeight}%)</Typography>
                <Slider
                  value={routingConfig.performanceWeight}
                  onChange={(e, value) => setRoutingConfig({
                    ...routingConfig,
                    performanceWeight: value as number
                  })}
                  min={0}
                  max={100}
                  step={5}
                  valueLabelDisplay="auto"
                />
              </Box>
              
              <Box mb={3}>
                <Typography gutterBottom>Доступност ({routingConfig.availabilityWeight}%)</Typography>
                <Slider
                  value={routingConfig.availabilityWeight}
                  onChange={(e, value) => setRoutingConfig({
                    ...routingConfig,
                    availabilityWeight: value as number
                  })}
                  min={0}
                  max={100}
                  step={5}
                  valueLabelDisplay="auto"
                />
              </Box>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                Збир свих тежишних вредности треба да буде 100%. 
                Тренутни збир: {
                  routingConfig.skillWeight + 
                  routingConfig.workloadWeight + 
                  routingConfig.performanceWeight + 
                  routingConfig.availabilityWeight + 
                  routingConfig.categoryExperienceWeight
                }%
              </Alert>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Распоређивање Оптерећења" />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch
                    checked={loadBalancingConfig.isActive}
                    onChange={(e) => setLoadBalancingConfig({
                      ...loadBalancingConfig,
                      isActive: e.target.checked
                    })}
                  />
                }
                label="Аутоматско Распоређивање"
              />
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Стратегија</InputLabel>
                <Select
                  value={loadBalancingConfig.strategy}
                  label="Стратегија"
                  onChange={(e) => setLoadBalancingConfig({
                    ...loadBalancingConfig,
                    strategy: e.target.value as any
                  })}
                >
                  <MenuItem value="round_robin">Кружно Распоређивање</MenuItem>
                  <MenuItem value="least_loaded">Најмање Оптерећен</MenuItem>
                  <MenuItem value="weighted_distribution">Тежишна Дистрибуција</MenuItem>
                  <MenuItem value="skill_based_balancing">На Основу Вештина</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                label="Праг Хитности (%)"
                type="number"
                value={loadBalancingConfig.emergencyThreshold}
                onChange={(e) => setLoadBalancingConfig({
                  ...loadBalancingConfig,
                  emergencyThreshold: parseInt(e.target.value)
                })}
                margin="normal"
                inputProps={{ min: 50, max: 100 }}
              />
              
              <TextField
                fullWidth
                label="Интервал Распоређивања (минути)"
                type="number"
                value={loadBalancingConfig.rebalanceInterval}
                onChange={(e) => setLoadBalancingConfig({
                  ...loadBalancingConfig,
                  rebalanceInterval: parseInt(e.target.value)
                })}
                margin="normal"
                inputProps={{ min: 5, max: 180 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <Box mt={3} display="flex" gap={2}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSaveConfiguration}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Чување...' : 'Сачувај Конфигурацију'}
        </Button>
        
        {saveStatus === 'saved' && (
          <Alert severity="success" sx={{ display: 'flex', alignItems: 'center' }}>
            Конфигурација је успешно сачувана
          </Alert>
        )}
        
        {saveStatus === 'error' && (
          <Alert severity="error" sx={{ display: 'flex', alignItems: 'center' }}>
            Грешка при чувању конфигурације
          </Alert>
        )}
      </Box>
    </Box>
  );

  const renderRoutingRules = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Правила Рутирања</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedRule(null);
            setRuleDialogOpen(true);
          }}
        >
          Додај Правило
        </Button>
      </Box>

      {routingRules.map((rule) => (
        <Accordion key={rule.id}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" width="100%">
              <Box flex={1}>
                <Typography variant="subtitle1">{rule.displayName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {rule.description}
                </Typography>
              </Box>
              <Box display="flex" gap={1} alignItems="center">
                <Chip 
                  label={rule.isActive ? 'Активно' : 'Неактивно'} 
                  size="small"
                  color={rule.isActive ? 'success' : 'default'}
                />
                <Typography variant="caption" color="text.secondary">
                  Приоритет: {rule.priority}
                </Typography>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Услови:</Typography>
                {rule.conditions.map((condition, index) => (
                  <Chip
                    key={index}
                    label={`${condition.field} ${condition.operator} ${condition.value}`}
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Акције:</Typography>
                {rule.actions.map((action, index) => (
                  <Chip
                    key={index}
                    label={action.type}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Grid>
            </Grid>
            <Box mt={2} display="flex" gap={1}>
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => {
                  setSelectedRule(rule);
                  setRuleDialogOpen(true);
                }}
              >
                Уреди
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => {
                  setRoutingRules(routingRules.filter(r => r.id !== rule.id));
                }}
              >
                Обриши
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  const renderMonitoring = () => (
    <Box>
      <Typography variant="h6" mb={3}>Мониторинг Рутирања</Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AssignmentIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Активни Тикети</Typography>
              </Box>
              <Typography variant="h4" color="primary">158</Typography>
              <Typography variant="body2" color="text.secondary">
                +12% у односу на јуче
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SpeedIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Просечно Време</Typography>
              </Box>
              <Typography variant="h4" color="success.main">4.2h</Typography>
              <Typography variant="body2" color="text.secondary">
                -8% у односу на јуче
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <BalanceIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Распоређивање</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">94.2%</Typography>
              <Typography variant="body2" color="text.secondary">
                Ефикасност рутирања
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <Card sx={{ mt: 3 }}>
        <CardHeader title="Стање Агената" />
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Агент</TableCell>
                  <TableCell>Стање</TableCell>
                  <TableCell>Тикети</TableCell>
                  <TableCell>Искоришћеност</TableCell>
                  <TableCell>Последњи Тикет</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {agents.slice(0, 5).map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>{agent.displayName}</TableCell>
                    <TableCell>
                      <Chip 
                        label={agent.isActive ? 'Доступан' : 'Недоступан'} 
                        size="small"
                        color={agent.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{agent.currentWorkload}</TableCell>
                    <TableCell>
                      <LinearProgress 
                        variant="determinate" 
                        value={agent.utilizationPercent} 
                        sx={{ width: 60 }}
                        color={
                          agent.utilizationPercent > 90 ? 'error' :
                          agent.utilizationPercent > 70 ? 'warning' : 'primary'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {format(new Date(), 'HH:mm', { locale: sr })}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" display="flex" alignItems="center" gap={1}>
            <SettingsIcon />
            Админ Преглед Рутирања
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Конфигурација и управљање системом паметног рутирања тикета
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          <Tooltip title="Освежи податке">
            <IconButton onClick={loadInitialData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Tabs */}
      <Box borderBottom={1} borderColor="divider" mb={3}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Агенти" icon={<PeopleIcon />} />
          <Tab label="Конфигурација" icon={<SettingsIcon />} />
          <Tab label="Правила" icon={<AssignmentIcon />} />
          <Tab label="Мониторинг" icon={<BarChartIcon />} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <LinearProgress sx={{ width: '50%' }} />
        </Box>
      ) : (
        <Box>
          {activeTab === 0 && renderAgentManagement()}
          {activeTab === 1 && renderRoutingConfiguration()}
          {activeTab === 2 && renderRoutingRules()}
          {activeTab === 3 && renderMonitoring()}
        </Box>
      )}
    </Box>
  );
};

export default RoutingAdminDashboard; 