import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Send as SendIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import api from '../../services/api';

interface EmailStatus {
  isAvailable: boolean;
  isConfigured: boolean;
  testResult: {
    success: boolean;
    message: string;
  };
  configuration: {
    host: string;
    port: string;
    from: string;
    hasCredentials: boolean;
  };
}

const EmailManagementPage: React.FC = (): JSX.Element => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmailData, setTestEmailData] = useState({
    to: '',
    subject: '',
    message: ''
  });
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);

  useEffect(() => {
    loadEmailStatus();
  }, []);

  const loadEmailStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/email/status');
      setEmailStatus(response.data.data);
    } catch (error: any) {
      console.error('Грешка при учитавању статуса email сервиса:', error);
      setAlert({
        type: 'error',
        message: 'Грешка при учитавању статуса email сервиса'
      });
    } finally {
      setLoading(false);
    }
  };

  const testEmailConfiguration = async () => {
    try {
      setLoading(true);
      const response = await api.get('/email/config/test');
      
      if (response.data.success) {
        setAlert({
          type: 'success',
          message: response.data.message
        });
      } else {
        setAlert({
          type: 'error',
          message: response.data.message
        });
      }
      
      // Освежи статус након тестирања
      await loadEmailStatus();
    } catch (error: any) {
      console.error('Грешка при тестирању email конфигурације:', error);
      setAlert({
        type: 'error',
        message: error.response?.data?.message || 'Грешка при тестирању email конфигурације'
      });
    } finally {
      setLoading(false);
    }
  };

  const sendTestEmail = async () => {
    try {
      setTestEmailLoading(true);
      
      if (!testEmailData.to || !testEmailData.subject || !testEmailData.message) {
        setAlert({
          type: 'warning',
          message: 'Молимо попуните сва поља за тест email'
        });
        return;
      }

      const response = await api.post('/email/test', testEmailData);
      
      if (response.data.success) {
        setAlert({
          type: 'success',
          message: 'Тест email је успешно послат'
        });
        setTestEmailOpen(false);
        setTestEmailData({ to: '', subject: '', message: '' });
      } else {
        setAlert({
          type: 'error',
          message: response.data.message
        });
      }
    } catch (error: any) {
      console.error('Грешка при слању тест email-а:', error);
      setAlert({
        type: 'error',
        message: error.response?.data?.message || 'Грешка при слању тест email-а'
      });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const getStatusColor = (isAvailable: boolean, isConfigured: boolean) => {
    if (isAvailable && isConfigured) return 'success';
    if (isConfigured) return 'warning';
    return 'error';
  };

  const getStatusText = (isAvailable: boolean, isConfigured: boolean) => {
    if (isAvailable && isConfigured) return 'Активан';
    if (isConfigured) return 'Конфигурисан';
    return 'Неактиван';
  };

  const getStatusIcon = (isAvailable: boolean, isConfigured: boolean) => {
    if (isAvailable && isConfigured) return <CheckCircleIcon />;
    if (isConfigured) return <WarningIcon />;
    return <ErrorIcon />;
  };

  if (loading && !emailStatus) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon />
          Управљање Email Сервисом
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadEmailStatus}
          disabled={loading}
        >
          Освежи статус
        </Button>
      </Box>

      {alert && (
        <Alert 
          severity={alert.type} 
          sx={{ mb: 3 }}
          onClose={() => setAlert(null)}
        >
          {alert.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Статус сервиса */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon />
                Статус Email Сервиса
              </Typography>
              
              {emailStatus && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {getStatusIcon(emailStatus.isAvailable, emailStatus.isConfigured)}
                    <Chip
                      label={getStatusText(emailStatus.isAvailable, emailStatus.isConfigured)}
                      color={getStatusColor(emailStatus.isAvailable, emailStatus.isConfigured)}
                      variant="outlined"
                    />
                  </Box>

                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        {emailStatus.isConfigured ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary="Конфигурација"
                        secondary={emailStatus.isConfigured ? 'Подешено' : 'Није подешено'}
                      />
                    </ListItem>
                    
                    <ListItem>
                      <ListItemIcon>
                        {emailStatus.configuration.hasCredentials ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary="Акредитиви"
                        secondary={emailStatus.configuration.hasCredentials ? 'Подешени' : 'Нису подешени'}
                      />
                    </ListItem>

                    <ListItem>
                      <ListItemIcon>
                        {emailStatus.testResult.success ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary="Тест конекције"
                        secondary={emailStatus.testResult.message}
                      />
                    </ListItem>
                  </List>

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      onClick={testEmailConfiguration}
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={16} /> : <CheckCircleIcon />}
                    >
                      Тестирај конфигурацију
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Конфигурација */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon />
                Тренутна конфигурација
              </Typography>
              
              {emailStatus && (
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="SMTP Host"
                      secondary={emailStatus.configuration.host}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText 
                      primary="SMTP Port"
                      secondary={emailStatus.configuration.port}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText 
                      primary="From адреса"
                      secondary={emailStatus.configuration.from}
                    />
                  </ListItem>
                </List>
              )}

              <Divider sx={{ my: 2 }} />
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  За конфигурацију email сервиса, подесите следеће environment варијабле:
                </Typography>
                <Box component="ul" sx={{ mt: 1, mb: 0 }}>
                  <li>EMAIL_HOST</li>
                  <li>EMAIL_PORT</li>
                  <li>EMAIL_USER</li>
                  <li>EMAIL_PASS</li>
                  <li>EMAIL_FROM</li>
                </Box>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Тест email */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SendIcon />
                Тест Email
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Пошаљите тест email да проверите да ли email сервис ради исправно.
              </Typography>

              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={() => setTestEmailOpen(true)}
                disabled={!emailStatus?.isAvailable}
              >
                Пошаљи тест email
              </Button>
              
              {!emailStatus?.isAvailable && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Email сервис није доступан. Проверите конфигурацију.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog за тест email */}
      <Dialog open={testEmailOpen} onClose={() => setTestEmailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Пошаљи тест email</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Прималац (email адреса)"
              type="email"
              value={testEmailData.to}
              onChange={(e) => setTestEmailData({ ...testEmailData, to: e.target.value })}
              sx={{ mb: 2 }}
              placeholder="primer@pio.gov.rs"
            />
            
            <TextField
              fullWidth
              label="Наслов"
              value={testEmailData.subject}
              onChange={(e) => setTestEmailData({ ...testEmailData, subject: e.target.value })}
              sx={{ mb: 2 }}
              placeholder="Тест email из PIO Help Desk система"
            />
            
            <TextField
              fullWidth
              label="Порука"
              multiline
              rows={4}
              value={testEmailData.message}
              onChange={(e) => setTestEmailData({ ...testEmailData, message: e.target.value })}
              placeholder="Ово је тест порука за проверу email функционалности..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestEmailOpen(false)}>
            Откажи
          </Button>
          <Button 
            onClick={sendTestEmail}
            variant="contained"
            disabled={testEmailLoading}
            startIcon={testEmailLoading ? <CircularProgress size={16} /> : <SendIcon />}
          >
            Пошаљи
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmailManagementPage; 