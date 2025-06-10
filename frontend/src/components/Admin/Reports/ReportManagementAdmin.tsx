import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  Tooltip,
  Menu,
  MenuItem as MenuOption,
  Divider,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileDownload as ExportIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
  Assessment as ReportIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Group as GroupIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CalendarToday as CalendarIcon,
  Email as EmailIcon,
  Description as TemplateIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Mock data interfaces
interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  usageCount: number;
  status: 'active' | 'draft' | 'archived';
}

interface ScheduledReport {
  id: string;
  templateName: string;
  schedule: string;
  recipients: string[];
  nextRun: Date;
  lastRun?: Date;
  status: 'active' | 'paused' | 'error';
  createdBy: string;
}

interface UserPermission {
  userId: string;
  username: string;
  email: string;
  role: string;
  permissions: {
    canCreateReports: boolean;
    canEditReports: boolean;
    canDeleteReports: boolean;
    canScheduleReports: boolean;
    canManagePermissions: boolean;
    canExportReports: boolean;
  };
  lastAccess?: Date;
}

interface ExportHistory {
  id: string;
  reportName: string;
  format: 'pdf' | 'excel' | 'csv';
  exportedBy: string;
  exportedAt: Date;
  fileSize: number;
  status: 'success' | 'failed' | 'processing';
  downloadUrl?: string;
}

const ReportManagementAdmin: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  
  // Dialog states
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Menu states
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  useEffect(() => {
    loadMockData();
  }, []);

  const loadMockData = () => {
    // Mock report templates
    setTemplates([
      {
        id: '1',
        name: 'Извештај о Обиму Тикета',
        description: 'Месечни преглед обима и трендова тикета',
        category: 'Тикети',
        isPublic: true,
        createdBy: 'Марко Петровић',
        createdAt: new Date('2024-01-15'),
        lastModified: new Date('2024-11-25'),
        usageCount: 45,
        status: 'active'
      },
      {
        id: '2',
        name: 'SLA Усаглашеност',
        description: 'Анализа усаглашености са SLA стандардима',
        category: 'SLA',
        isPublic: true,
        createdBy: 'Ана Јовановић',
        createdAt: new Date('2024-02-10'),
        lastModified: new Date('2024-11-20'),
        usageCount: 32,
        status: 'active'
      },
      {
        id: '3',
        name: 'Перформансе Корисника',
        description: 'Приватни извештај о перформансама тима',
        category: 'Корисници',
        isPublic: false,
        createdBy: 'Стефан Николић',
        createdAt: new Date('2024-03-05'),
        lastModified: new Date('2024-11-18'),
        usageCount: 18,
        status: 'draft'
      }
    ]);

    // Mock scheduled reports
    setScheduledReports([
      {
        id: '1',
        templateName: 'Извештај о Обиму Тикета',
        schedule: 'Дневно у 08:00',
        recipients: ['marko@pio.rs', 'ana@pio.rs'],
        nextRun: new Date('2024-12-01T08:00:00'),
        lastRun: new Date('2024-11-30T08:00:00'),
        status: 'active',
        createdBy: 'Марко Петровић'
      },
      {
        id: '2',
        templateName: 'SLA Усаглашеност',
        schedule: 'Недељно понедељком у 09:00',
        recipients: ['stefan@pio.rs', 'management@pio.rs'],
        nextRun: new Date('2024-12-02T09:00:00'),
        lastRun: new Date('2024-11-25T09:00:00'),
        status: 'active',
        createdBy: 'Ана Јовановић'
      },
      {
        id: '3',
        templateName: 'Перформансе Корисника',
        schedule: 'Месечно 1. у месецу у 10:00',
        recipients: ['hr@pio.rs'],
        nextRun: new Date('2025-01-01T10:00:00'),
        status: 'paused',
        createdBy: 'Стефан Николић'
      }
    ]);

    // Mock user permissions
    setUserPermissions([
      {
        userId: '1',
        username: 'marko.petrovic',
        email: 'marko@pio.rs',
        role: 'Админ',
        permissions: {
          canCreateReports: true,
          canEditReports: true,
          canDeleteReports: true,
          canScheduleReports: true,
          canManagePermissions: true,
          canExportReports: true
        },
        lastAccess: new Date('2024-11-30T14:30:00')
      },
      {
        userId: '2',
        username: 'ana.jovanovic',
        email: 'ana@pio.rs',
        role: 'Менаџер',
        permissions: {
          canCreateReports: true,
          canEditReports: true,
          canDeleteReports: false,
          canScheduleReports: true,
          canManagePermissions: false,
          canExportReports: true
        },
        lastAccess: new Date('2024-11-30T16:45:00')
      },
      {
        userId: '3',
        username: 'stefan.nikolic',
        email: 'stefan@pio.rs',
        role: 'Аналитичар',
        permissions: {
          canCreateReports: true,
          canEditReports: true,
          canDeleteReports: false,
          canScheduleReports: false,
          canManagePermissions: false,
          canExportReports: true
        },
        lastAccess: new Date('2024-11-29T11:20:00')
      }
    ]);

    // Mock export history
    setExportHistory([
      {
        id: '1',
        reportName: 'Извештај о Обиму Тикета',
        format: 'pdf',
        exportedBy: 'Марко Петровић',
        exportedAt: new Date('2024-11-30T15:30:00'),
        fileSize: 245760,
        status: 'success',
        downloadUrl: '/exports/ticket-volume-20241130.pdf'
      },
      {
        id: '2',
        reportName: 'SLA Усаглашеност',
        format: 'excel',
        exportedBy: 'Ана Јовановић',
        exportedAt: new Date('2024-11-30T14:15:00'),
        fileSize: 512000,
        status: 'success',
        downloadUrl: '/exports/sla-compliance-20241130.xlsx'
      },
      {
        id: '3',
        reportName: 'Перформансе Корисника',
        format: 'csv',
        exportedBy: 'Стефан Николић',
        exportedAt: new Date('2024-11-30T12:00:00'),
        fileSize: 89432,
        status: 'failed'
      }
    ]);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, itemId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedItemId(itemId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedItemId('');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'paused': return 'warning';
      case 'error': case 'failed': return 'error';
      case 'draft': return 'info';
      case 'processing': return 'info';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Активан';
      case 'paused': return 'Паузиран';
      case 'error': return 'Грешка';
      case 'failed': return 'Неуспешно';
      case 'draft': return 'Нацрт';
      case 'processing': return 'У току';
      case 'success': return 'Успешно';
      case 'archived': return 'Архивиран';
      default: return status;
    }
  };

  // Templates Tab Content
  const renderTemplatesTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          <TemplateIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Управљање Извештај Template-има
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setTemplateDialogOpen(true)}
        >
          Нови Template
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Назив</TableCell>
              <TableCell>Категорија</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Приступност</TableCell>
              <TableCell>Употреба</TableCell>
              <TableCell>Аутор</TableCell>
              <TableCell>Последњa Измена</TableCell>
              <TableCell align="center">Акције</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2">{template.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {template.description}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={template.category} size="small" />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={getStatusLabel(template.status)} 
                    color={getStatusColor(template.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={template.isPublic ? 'Јавни' : 'Приватни'}
                    color={template.isPublic ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Badge badgeContent={template.usageCount} color="primary">
                    <ReportIcon color="action" />
                  </Badge>
                </TableCell>
                <TableCell>{template.createdBy}</TableCell>
                <TableCell>
                  {format(template.lastModified, 'dd.MM.yyyy HH:mm', { locale: sr })}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, template.id)}
                  >
                    <MoreIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // Scheduled Reports Tab Content
  const renderScheduledReportsTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Заказани Извештаји
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setScheduleDialogOpen(true)}
        >
          Нови Заказани Извештај
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Template</TableCell>
              <TableCell>Распоред</TableCell>
              <TableCell>Примаоци</TableCell>
              <TableCell>Следеће Извршавање</TableCell>
              <TableCell>Последње Извршавање</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Креирао</TableCell>
              <TableCell align="center">Акције</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {scheduledReports.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell>
                  <Typography variant="subtitle2">{schedule.templateName}</Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center">
                    <CalendarIcon sx={{ mr: 1, fontSize: 16 }} />
                    {schedule.schedule}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box>
                    {schedule.recipients.slice(0, 2).map((email, index) => (
                      <Chip
                        key={index}
                        label={email}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                    {schedule.recipients.length > 2 && (
                      <Chip
                        label={`+${schedule.recipients.length - 2} више`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {format(schedule.nextRun, 'dd.MM.yyyy HH:mm', { locale: sr })}
                </TableCell>
                <TableCell>
                  {schedule.lastRun 
                    ? format(schedule.lastRun, 'dd.MM.yyyy HH:mm', { locale: sr })
                    : 'Никад'
                  }
                </TableCell>
                <TableCell>
                  <Chip 
                    label={getStatusLabel(schedule.status)} 
                    color={getStatusColor(schedule.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{schedule.createdBy}</TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, schedule.id)}
                  >
                    <MoreIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // User Permissions Tab Content
  const renderPermissionsTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Корисничке Дозволе
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setPermissionDialogOpen(true)}
        >
          Додели Дозволе
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Корисник</TableCell>
              <TableCell>Улога</TableCell>
              <TableCell>Дозволе</TableCell>
              <TableCell>Последњи Приступ</TableCell>
              <TableCell align="center">Акције</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {userPermissions.map((user) => (
              <TableRow key={user.userId}>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2">{user.username}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.email}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={user.role} color="primary" size="small" />
                </TableCell>
                <TableCell>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {user.permissions.canCreateReports && (
                      <Chip label="Креирање" size="small" color="success" />
                    )}
                    {user.permissions.canEditReports && (
                      <Chip label="Измена" size="small" color="info" />
                    )}
                    {user.permissions.canDeleteReports && (
                      <Chip label="Брисање" size="small" color="error" />
                    )}
                    {user.permissions.canScheduleReports && (
                      <Chip label="Заказивање" size="small" color="warning" />
                    )}
                    {user.permissions.canExportReports && (
                      <Chip label="Export" size="small" color="secondary" />
                    )}
                    {user.permissions.canManagePermissions && (
                      <Chip label="Управљање" size="small" color="default" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {user.lastAccess 
                    ? format(user.lastAccess, 'dd.MM.yyyy HH:mm', { locale: sr })
                    : 'Никад'
                  }
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, user.userId)}
                  >
                    <MoreIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // Export History Tab Content
  const renderExportHistoryTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Историја Export-а
        </Typography>
        <Button variant="outlined" startIcon={<ExportIcon />}>
          Export Историје
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Извештај</TableCell>
              <TableCell>Формат</TableCell>
              <TableCell>Експортовао</TableCell>
              <TableCell>Време Export-а</TableCell>
              <TableCell>Величина Фајла</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell align="center">Акције</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exportHistory.map((export_) => (
              <TableRow key={export_.id}>
                <TableCell>
                  <Typography variant="subtitle2">{export_.reportName}</Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={export_.format.toUpperCase()} 
                    size="small"
                    color={export_.format === 'pdf' ? 'error' : export_.format === 'excel' ? 'success' : 'info'}
                  />
                </TableCell>
                <TableCell>{export_.exportedBy}</TableCell>
                <TableCell>
                  {format(export_.exportedAt, 'dd.MM.yyyy HH:mm', { locale: sr })}
                </TableCell>
                <TableCell>{formatFileSize(export_.fileSize)}</TableCell>
                <TableCell>
                  <Chip 
                    label={getStatusLabel(export_.status)} 
                    color={getStatusColor(export_.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  {export_.status === 'success' && export_.downloadUrl && (
                    <Tooltip title="Преузми">
                      <IconButton size="small">
                        <ExportIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, export_.id)}
                  >
                    <MoreIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <Box sx={{ width: '100%' }}>
      <Card>
        <CardContent>
          <Typography variant="h4" component="h1" gutterBottom>
            <SettingsIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Админ Панел - Управљање Извештајима
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph>
            Централизовано управљање извештај template-има, заказаним извештајима, 
            корисничким дозволама и историјом export-а.
          </Typography>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={currentTab} onChange={handleTabChange}>
              <Tab 
                label="Template-и" 
                icon={<TemplateIcon />}
                iconPosition="start"
              />
              <Tab 
                label="Заказани Извештаји" 
                icon={<ScheduleIcon />}
                iconPosition="start"
              />
              <Tab 
                label="Дозволе" 
                icon={<SecurityIcon />}
                iconPosition="start"
              />
              <Tab 
                label="Историја Export-а" 
                icon={<HistoryIcon />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          <TabPanel value={currentTab} index={0}>
            {renderTemplatesTab()}
          </TabPanel>
          
          <TabPanel value={currentTab} index={1}>
            {renderScheduledReportsTab()}
          </TabPanel>
          
          <TabPanel value={currentTab} index={2}>
            {renderPermissionsTab()}
          </TabPanel>
          
          <TabPanel value={currentTab} index={3}>
            {renderExportHistoryTab()}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuOption onClick={handleMenuClose}>
          <ViewIcon sx={{ mr: 1 }} />
          Прегледај
        </MenuOption>
        <MenuOption onClick={handleMenuClose}>
          <EditIcon sx={{ mr: 1 }} />
          Измени
        </MenuOption>
        <Divider />
        <MenuOption onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Обриши
        </MenuOption>
      </Menu>

      {/* TODO: Add dialogs for create/edit operations */}
      {/* Template Dialog, Schedule Dialog, Permission Dialog */}
    </Box>
  );
};

export default ReportManagementAdmin; 